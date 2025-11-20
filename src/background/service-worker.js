/**
 * Service Worker for Netflix Ratings Extension
 *
 * Handles:
 * - Message passing between content scripts and OMDB API
 * - API key management
 * - Rating data caching (via CacheManager)
 * - Background fetch operations
 *
 * @module ServiceWorker
 */

console.log('[Service Worker] Netflix Ratings service worker loaded');

// Import CacheManager
// In Chrome extensions, we need to use dynamic imports or inline
// For now, we'll create a minimal instance here
const OMDB_API_BASE_URL = 'https://www.omdbapi.com/';
const DEFAULT_API_KEY = 'b9bd48a6'; // Fallback API key

// Global cache manager instance
let cacheManager = null;

/**
 * Initialize cache manager
 */
async function initializeCacheManager() {
  try {
    // Import CacheManager class
    const CacheManager = await import('../utils/cache-manager.js').then(m => m.default || m);
    cacheManager = new CacheManager();
    await cacheManager.init();
    console.log('[Service Worker] Cache manager initialized');
  } catch (error) {
    console.warn('[Service Worker] Failed to load CacheManager, using fallback cache:', error.message);
    // Fallback: create simple in-memory cache if CacheManager fails
    cacheManager = createFallbackCacheManager();
  }
}

/**
 * Create fallback cache manager for when CacheManager import fails
 * @returns {Object} Simple cache manager object
 */
function createFallbackCacheManager() {
  const fallbackCache = new Map();
  const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

  return {
    get: async function(key) {
      const entry = fallbackCache.get(key);
      if (!entry) return null;

      const age = Date.now() - entry.timestamp;
      if (age > CACHE_DURATION_MS) {
        fallbackCache.delete(key);
        return null;
      }
      return entry.data;
    },

    set: async function(key, data) {
      fallbackCache.set(key, {
        data,
        timestamp: Date.now(),
      });
      console.log('[Service Worker] Cached to fallback:', key, `Cache size: ${fallbackCache.size}`);
    },

    clear: async function() {
      const size = fallbackCache.size;
      fallbackCache.clear();
      return size;
    },

    getStats: async function() {
      return {
        totalItems: fallbackCache.size,
        sizeEstimateKb: 0,
        cacheDurationHours: 24,
      };
    },

    getCacheDuration: async function() {
      return 24;
    },

    setCacheDuration: async function(hours) {
      console.log('[Service Worker] Fallback cache manager ignoring duration change');
    },
  };
}

/**
 * Initialize service worker
 */
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[Service Worker] Extension installed/updated:', details.reason);

  if (details.reason === 'install') {
    console.log('[Service Worker] First install - setting default API key');
    chrome.storage.sync.set({
      omdbApiKey: DEFAULT_API_KEY,
      cacheDurationHours: 24, // Default 24 hours
    });
  }

  // Initialize cache manager
  initializeCacheManager().catch(err => {
    console.error('[Service Worker] Failed to initialize cache manager:', err);
  });
});

// Initialize cache manager on startup
initializeCacheManager().catch(err => {
  console.error('[Service Worker] Failed to initialize cache manager on startup:', err);
});

/**
 * Handle messages from content scripts and popup
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

  if (request.type === 'CACHE_DURATION_CHANGED') {
    console.log('[Service Worker] Handling CACHE_DURATION_CHANGED request');
    handleCacheDurationChanged(request.duration, sendResponse);
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
    // Wait for cache manager to be ready
    if (!cacheManager) {
      await initializeCacheManager();
    }

    // Get API key from storage
    const apiKey = await getApiKey();
    console.log('[Service Worker] API key retrieved:', apiKey ? '✓' : '✗');

    // Check cache first
    const cacheKey = createCacheKey(payload);
    const cached = await cacheManager.get(cacheKey);

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
    await cacheManager.set(cacheKey, ratings);

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
async function handleClearCache(sendResponse) {
  try {
    if (!cacheManager) {
      await initializeCacheManager();
    }

    // Get stats before clearing
    const stats = await cacheManager.getStats();
    const cleared = stats.totalItems || 0;

    // Clear cache
    await cacheManager.clear();
    console.log(`[Service Worker] Cache cleared. Removed ${cleared} entries`);

    sendResponse({ success: true, cleared });
  } catch (error) {
    console.error('[Service Worker] Error clearing cache:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Handle get cache stats request
 *
 * @param {Function} sendResponse - Response callback
 */
async function handleGetCacheStats(sendResponse) {
  try {
    if (!cacheManager) {
      await initializeCacheManager();
    }

    const stats = await cacheManager.getStats();
    console.log('[Service Worker] Cache stats:', stats);

    sendResponse({ success: true, stats });
  } catch (error) {
    console.error('[Service Worker] Error getting cache stats:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Handle cache duration change notification
 *
 * @param {number} duration - New cache duration in hours
 * @param {Function} sendResponse - Response callback
 */
async function handleCacheDurationChanged(duration, sendResponse) {
  try {
    console.log('[Service Worker] Cache duration changed to:', duration, 'hours');

    if (!cacheManager) {
      await initializeCacheManager();
    }

    // Update cache manager's understanding of the new duration
    await cacheManager.setCacheDuration(duration);

    console.log('[Service Worker] Cache duration updated successfully');
    sendResponse({ success: true, message: 'Cache duration updated' });
  } catch (error) {
    console.error('[Service Worker] Error updating cache duration:', error);
    sendResponse({ success: false, error: error.message });
  }
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
 * Sleep utility
 *
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

console.log('[Service Worker] Initialization complete');
