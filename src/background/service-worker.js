/**
 * Service Worker for Netflix Ratings Extension
 *
 * Handles:
 * - Message passing between content scripts and OMDB API
 * - API key management
 * - Rating data caching
 * - Background fetch operations
 *
 * @module ServiceWorker
 */

console.log('[Service Worker] Netflix Ratings service worker loaded');

// Import OMDB service (note: in Chrome extension, we'll need to load this differently)
// For now, we'll inline the necessary functionality

const OMDB_API_BASE_URL = 'https://www.omdbapi.com/';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_API_KEY = 'b9bd48a6'; // Fallback API key

// In-memory cache for ratings (persists while service worker is alive)
let ratingsCache = new Map();

/**
 * Initialize service worker
 */
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[Service Worker] Extension installed/updated:', details.reason);

  if (details.reason === 'install') {
    console.log('[Service Worker] First install - setting default API key');
    chrome.storage.sync.set({ omdbApiKey: DEFAULT_API_KEY });
  }
});

/**
 * Handle messages from content scripts
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Service Worker] Received message:', request.type, 'from tab:', sender.tab?.id);

  if (request.type === 'FETCH_RATINGS') {
    console.log('[Service Worker] Handling FETCH_RATINGS request');
    handleFetchRatings(request.payload, sendResponse);
    return true; // Keep channel open for async response
  }

  if (request.type === 'CLEAR_CACHE') {
    console.log('[Service Worker] Handling CLEAR_CACHE request');
    handleClearCache(sendResponse);
    return true;
  }

  if (request.type === 'GET_CACHE_STATS') {
    console.log('[Service Worker] Handling GET_CACHE_STATS request');
    handleGetCacheStats(sendResponse);
    return true;
  }

  console.log('[Service Worker] Unknown message type:', request.type);
  sendResponse({ success: false, error: 'Unknown message type' });
  return false;
});

/**
 * Handle fetch ratings request
 *
 * @param {Object} payload - Request payload { title, year?, type? }
 * @param {Function} sendResponse - Response callback
 */
async function handleFetchRatings(payload, sendResponse) {
  console.log('[Service Worker] Fetching ratings for:', payload);

  if (!payload || !payload.title) {
    console.error('[Service Worker] Invalid payload: missing title');
    sendResponse({ success: false, error: 'Title is required' });
    return;
  }

  try {
    // Get API key from storage
    const apiKey = await getApiKey();
    console.log('[Service Worker] API key retrieved:', apiKey ? '✓' : '✗');

    // Check cache first
    const cacheKey = createCacheKey(payload);
    const cached = getFromCache(cacheKey);

    if (cached) {
      console.log('[Service Worker] Cache hit for:', payload.title);
      sendResponse({ success: true, ratings: cached });
      return;
    }

    console.log('[Service Worker] Cache miss, fetching from OMDB');

    // Fetch from OMDB API
    const omdbData = await fetchFromOmdb(apiKey, payload);

    if (!omdbData) {
      console.log('[Service Worker] No data found for:', payload.title);
      sendResponse({ success: false, error: 'No data found' });
      return;
    }

    // Extract ratings
    const ratings = extractRatings(omdbData);
    console.log('[Service Worker] Extracted ratings:', ratings);

    // Cache the result
    setCache(cacheKey, ratings);

    sendResponse({ success: true, ratings });
  } catch (error) {
    console.error('[Service Worker] Error fetching ratings:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Handle clear cache request
 *
 * @param {Function} sendResponse - Response callback
 */
function handleClearCache(sendResponse) {
  const size = ratingsCache.size;
  ratingsCache.clear();
  console.log(`[Service Worker] Cache cleared. Removed ${size} entries`);
  sendResponse({ success: true, cleared: size });
}

/**
 * Handle get cache stats request
 *
 * @param {Function} sendResponse - Response callback
 */
function handleGetCacheStats(sendResponse) {
  const stats = {
    size: ratingsCache.size,
    entries: Array.from(ratingsCache.keys()),
  };
  console.log('[Service Worker] Cache stats:', stats);
  sendResponse({ success: true, stats });
}

/**
 * Get API key from storage
 *
 * @returns {Promise<string>} API key
 */
async function getApiKey() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['omdbApiKey'], (result) => {
      const apiKey = result.omdbApiKey || DEFAULT_API_KEY;
      console.log('[Service Worker] Retrieved API key from storage');
      resolve(apiKey);
    });
  });
}

/**
 * Fetch data from OMDB API
 *
 * @param {string} apiKey - OMDB API key
 * @param {Object} titleInfo - Title information { title, year?, type? }
 * @returns {Promise<Object|null>} OMDB response data
 */
async function fetchFromOmdb(apiKey, titleInfo) {
  console.log('[Service Worker] Fetching from OMDB:', titleInfo);

  const params = new URLSearchParams({
    apikey: apiKey,
    t: titleInfo.title.trim(),
    plot: 'short',
  });

  if (titleInfo.year) {
    params.append('y', titleInfo.year);
    console.log('[Service Worker] Adding year filter:', titleInfo.year);
  }

  if (titleInfo.type) {
    params.append('type', titleInfo.type);
    console.log('[Service Worker] Adding type filter:', titleInfo.type);
  }

  const url = `${OMDB_API_BASE_URL}?${params.toString()}`;
  console.log('[Service Worker] OMDB URL:', url.replace(apiKey, 'API_KEY_HIDDEN'));

  try {
    const response = await fetchWithRetry(url, 3);

    if (!response.ok) {
      console.error('[Service Worker] HTTP error:', response.status, response.statusText);
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    console.log('[Service Worker] OMDB response received');

    if (data.Response === 'False') {
      console.warn('[Service Worker] OMDB API returned error:', data.Error);
      return null;
    }

    console.log('[Service Worker] Successfully fetched:', data.Title, `(${data.Year})`);
    return data;
  } catch (error) {
    console.error('[Service Worker] Error fetching from OMDB:', error);
    throw error;
  }
}

/**
 * Fetch with retry logic
 *
 * @param {string} url - URL to fetch
 * @param {number} maxRetries - Maximum number of retries
 * @returns {Promise<Response>} Fetch response
 */
async function fetchWithRetry(url, maxRetries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`[Service Worker] Fetch attempt ${attempt}/${maxRetries}`);

    try {
      const response = await fetch(url);
      console.log('[Service Worker] Fetch successful');
      return response;
    } catch (error) {
      console.error(`[Service Worker] Fetch attempt ${attempt} failed:`, error.message);
      lastError = error;

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt - 1) * 1000; // Exponential backoff
        console.log(`[Service Worker] Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  console.error('[Service Worker] All retry attempts exhausted');
  throw new Error(`Failed after ${maxRetries} attempts: ${lastError.message}`);
}

/**
 * Extract ratings from OMDB response
 *
 * @param {Object} omdbData - OMDB API response
 * @returns {Object} Ratings { imdb?, metacritic?, rottenTomatoes? }
 */
function extractRatings(omdbData) {
  console.log('[Service Worker] Extracting ratings from:', omdbData.Title);

  const ratings = {
    imdb: null,
    metacritic: null,
    rottenTomatoes: null,
  };

  // Extract IMDb rating
  if (omdbData.imdbRating && omdbData.imdbRating !== 'N/A') {
    ratings.imdb = {
      value: omdbData.imdbRating,
      votes: omdbData.imdbVotes || 'N/A',
      outOf: '10',
    };
    console.log('[Service Worker] IMDb rating:', ratings.imdb.value);
  }

  // Extract Metacritic score
  if (omdbData.Metascore && omdbData.Metascore !== 'N/A') {
    ratings.metacritic = {
      value: omdbData.Metascore,
      outOf: '100',
    };
    console.log('[Service Worker] Metacritic score:', ratings.metacritic.value);
  }

  // Extract Rotten Tomatoes rating
  if (omdbData.Ratings && Array.isArray(omdbData.Ratings)) {
    const rtRating = omdbData.Ratings.find(r => r.Source === 'Rotten Tomatoes');
    if (rtRating && rtRating.Value) {
      ratings.rottenTomatoes = {
        value: rtRating.Value,
        source: rtRating.Source,
      };
      console.log('[Service Worker] Rotten Tomatoes rating:', ratings.rottenTomatoes.value);
    }
  }

  const availableRatings = Object.keys(ratings).filter(k => ratings[k] !== null);
  console.log('[Service Worker] Available ratings:', availableRatings.join(', ') || 'None');

  return ratings;
}

/**
 * Create cache key from title info
 *
 * @param {Object} titleInfo - Title information
 * @returns {string} Cache key
 */
function createCacheKey(titleInfo) {
  return `${titleInfo.title}:${titleInfo.year || ''}:${titleInfo.type || ''}`;
}

/**
 * Get item from cache if not expired
 *
 * @param {string} key - Cache key
 * @returns {Object|null} Cached data or null
 */
function getFromCache(key) {
  const cached = ratingsCache.get(key);

  if (!cached) {
    console.log('[Service Worker] Cache miss for:', key);
    return null;
  }

  const now = Date.now();
  const age = now - cached.timestamp;

  if (age > CACHE_DURATION_MS) {
    console.log('[Service Worker] Cache entry expired:', key);
    ratingsCache.delete(key);
    return null;
  }

  console.log('[Service Worker] Cache hit for:', key, `Age: ${Math.round(age / 1000 / 60)} minutes`);
  return cached.data;
}

/**
 * Set item in cache with timestamp
 *
 * @param {string} key - Cache key
 * @param {Object} data - Data to cache
 */
function setCache(key, data) {
  ratingsCache.set(key, {
    data,
    timestamp: Date.now(),
  });
  console.log('[Service Worker] Cached data for:', key, `Cache size: ${ratingsCache.size}`);
}

/**
 * Sleep utility
 *
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

console.log('[Service Worker] Initialization complete');
