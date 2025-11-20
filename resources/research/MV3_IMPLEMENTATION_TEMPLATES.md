# Chrome Extension Manifest V3 - Implementation Templates and Code Examples

**Last Updated:** November 19, 2025

This document contains ready-to-use code templates for common Netflix extension patterns.

---

## Template 1: Basic Netflix Movie Info Extractor

Complete working extension that extracts movie titles from Netflix and fetches IMDb data.

### Directory Structure
```
netflix-extractor/
├── manifest.json
├── src/
│   ├── service-worker.js
│   ├── content-script.js
│   ├── popup.html
│   └── popup.js
├── styles/
│   └── popup.css
├── images/
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
└── README.md
```

### manifest.json
```json
{
  "manifest_version": 3,
  "name": "Netflix Movie Info",
  "version": "1.0.0",
  "description": "View IMDb ratings and details for Netflix movies",
  "permissions": [
    "storage",
    "scripting"
  ],
  "host_permissions": [
    "https://www.netflix.com/*",
    "https://www.omdbapi.com/*"
  ],
  "background": {
    "service_worker": "src/service-worker.js"
  },
  "content_scripts": [
    {
      "matches": ["https://www.netflix.com/*"],
      "js": ["src/content-script.js"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_title": "Get IMDb info",
    "default_popup": "src/popup.html",
    "default_icon": "images/icon-48.png"
  },
  "icons": {
    "16": "images/icon-16.png",
    "48": "images/icon-48.png",
    "128": "images/icon-128.png"
  }
}
```

### src/service-worker.js
```javascript
/**
 * Netflix Movie Info Extension - Service Worker
 * Handles API calls to OMDb and manages state
 */

// Configuration
const CONFIG = {
  OMDB_API_ENDPOINT: 'https://www.omdbapi.com/',
  STORAGE_KEYS: {
    API_KEY: 'omdbApiKey',
    CACHE: 'movieCache',
    SETTINGS: 'settings'
  },
  CACHE_DURATION_MS: 86400000  // 24 hours
};

// Initialize on install
chrome.runtime.onInstalled.addListener(handleInstall);

// Message listener for all extension communications
chrome.runtime.onMessage.addListener(handleMessage);

/**
 * Handles extension installation and updates
 */
function handleInstall(details) {
  console.log('[ServiceWorker] Extension installed:', details.reason);

  if (details.reason === 'install') {
    // First time installation
    chrome.storage.local.set({
      [CONFIG.STORAGE_KEYS.SETTINGS]: {
        version: chrome.runtime.getManifest().version,
        installed: new Date().toISOString(),
        searchHistory: []
      }
    }).then(() => {
      console.log('[ServiceWorker] Initial settings created');
    });
  }

  if (details.reason === 'update') {
    console.log('[ServiceWorker] Extension updated to version:', chrome.runtime.getManifest().version);
  }
}

/**
 * Main message handler
 * Dispatches messages to appropriate handlers
 */
async function handleMessage(request, sender, sendResponse) {
  try {
    console.log('[ServiceWorker] Message received:', { type: request.type, from: sender.url });

    // Validate request
    if (!request.type || typeof request.type !== 'string') {
      sendResponse({ success: false, error: 'Invalid request format' });
      return;
    }

    // Dispatch to appropriate handler
    switch (request.type) {
      case 'FETCH_MOVIE_DATA':
        handleFetchMovieData(request, sendResponse);
        break;

      case 'GET_CACHED_MOVIE':
        handleGetCachedMovie(request, sendResponse);
        break;

      case 'SET_API_KEY':
        handleSetApiKey(request, sendResponse);
        break;

      case 'GET_API_KEY_STATUS':
        handleGetApiKeyStatus(request, sendResponse);
        break;

      case 'CLEAR_CACHE':
        handleClearCache(request, sendResponse);
        break;

      default:
        sendResponse({ success: false, error: 'Unknown request type: ' + request.type });
    }

    // Return true to indicate we'll respond asynchronously
    return true;

  } catch (error) {
    console.error('[ServiceWorker] Error handling message:', error);
    sendResponse({
      success: false,
      error: error.message || 'Unknown error'
    });
  }
}

/**
 * Fetch movie data from OMDb API
 */
async function handleFetchMovieData(request, sendResponse) {
  console.log('[ServiceWorker] Fetching movie:', request.title);

  const { title, forceRefresh } = request;

  try {
    // Validate input
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      sendResponse({ success: false, error: 'Invalid movie title' });
      return;
    }

    // Check cache first
    if (!forceRefresh) {
      const cached = await getCachedMovie(title);
      if (cached) {
        console.log('[ServiceWorker] Returning cached movie data');
        sendResponse({ success: true, data: cached, fromCache: true });
        return;
      }
    }

    // Get API key
    const apiKey = await getApiKey();
    if (!apiKey) {
      sendResponse({ success: false, error: 'API key not configured. Please set it in options.' });
      return;
    }

    // Fetch from API with retry
    const movieData = await fetchMovieWithRetry(title, apiKey, 3);

    // Cache the result
    await cacheMovie(title, movieData);

    // Update search history
    await updateSearchHistory(title);

    sendResponse({
      success: true,
      data: movieData,
      fromCache: false
    });

  } catch (error) {
    console.error('[ServiceWorker] Error fetching movie:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Fetch movie with exponential backoff retry
 */
async function fetchMovieWithRetry(title, apiKey, maxRetries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[ServiceWorker] Fetch attempt ${attempt}/${maxRetries}`);

      const response = await fetch(CONFIG.OMDB_API_ENDPOINT, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      // Use POST with body or GET with URL params based on API
      const url = new URL(CONFIG.OMDB_API_ENDPOINT);
      url.searchParams.set('t', title);
      url.searchParams.set('type', 'movie');
      url.searchParams.set('apikey', apiKey);

      const apiResponse = await fetch(url.toString());

      if (!apiResponse.ok) {
        throw new Error(`API returned ${apiResponse.status}: ${apiResponse.statusText}`);
      }

      const data = await apiResponse.json();

      if (data.Response === 'False') {
        throw new Error(data.Error || 'Movie not found');
      }

      // Normalize response
      return {
        title: data.Title,
        year: data.Year,
        rated: data.Rated,
        releaseDate: data.Released,
        runtime: data.Runtime,
        genre: data.Genre,
        director: data.Director,
        writer: data.Writer,
        actors: data.Actors,
        plot: data.Plot,
        language: data.Language,
        country: data.Country,
        awards: data.Awards,
        imdbId: data.imdbID,
        imdbRating: data.imdbRating,
        imdbVotes: data.imdbVotes,
        poster: data.Poster,
        type: data.Type,
        dvdRelease: data.DVD,
        boxOffice: data.BoxOffice,
        production: data.Production,
        website: data.Website,
        fetchedAt: new Date().toISOString()
      };

    } catch (error) {
      lastError = error;
      console.warn(`[ServiceWorker] Attempt ${attempt} failed:`, error.message);

      if (attempt < maxRetries) {
        // Exponential backoff
        const delayMs = Math.pow(2, attempt - 1) * 1000;
        console.log(`[ServiceWorker] Retrying in ${delayMs}ms`);
        await sleep(delayMs);
      }
    }
  }

  throw new Error(`Failed to fetch movie after ${maxRetries} attempts: ${lastError.message}`);
}

/**
 * Get cached movie if still fresh
 */
async function getCachedMovie(title) {
  try {
    const cacheKey = hashTitle(title);
    const cache = await chrome.storage.local.get(cacheKey);

    if (cache[cacheKey]) {
      const cached = cache[cacheKey];
      const ageMs = Date.now() - new Date(cached.fetchedAt).getTime();

      if (ageMs < CONFIG.CACHE_DURATION_MS) {
        console.log('[ServiceWorker] Cache hit for:', title);
        return cached;
      } else {
        console.log('[ServiceWorker] Cache expired for:', title);
        // Delete expired cache
        await chrome.storage.local.remove(cacheKey);
      }
    }

    return null;

  } catch (error) {
    console.error('[ServiceWorker] Error getting cached movie:', error);
    return null;
  }
}

/**
 * Cache movie data
 */
async function cacheMovie(title, movieData) {
  try {
    const cacheKey = hashTitle(title);
    const cacheData = {};
    cacheData[cacheKey] = movieData;

    await chrome.storage.local.set(cacheData);
    console.log('[ServiceWorker] Movie cached:', title);

  } catch (error) {
    console.error('[ServiceWorker] Error caching movie:', error);
  }
}

/**
 * Handle get cached movie request
 */
async function handleGetCachedMovie(request, sendResponse) {
  try {
    const cached = await getCachedMovie(request.title);
    sendResponse({
      success: true,
      data: cached
    });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Store API key
 */
async function handleSetApiKey(request, sendResponse) {
  try {
    const { apiKey } = request;

    if (!apiKey || typeof apiKey !== 'string') {
      sendResponse({ success: false, error: 'Invalid API key' });
      return;
    }

    await chrome.storage.sync.set({
      [CONFIG.STORAGE_KEYS.API_KEY]: apiKey
    });

    console.log('[ServiceWorker] API key saved');
    sendResponse({ success: true });

  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Get API key status
 */
async function handleGetApiKeyStatus(request, sendResponse) {
  try {
    const apiKey = await getApiKey();
    sendResponse({
      success: true,
      configured: !!apiKey
    });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Clear movie cache
 */
async function handleClearCache(request, sendResponse) {
  try {
    // Get all cached items (those that are hashed titles)
    const allStorage = await chrome.storage.local.get(null);
    const keysToDelete = Object.keys(allStorage).filter(key => {
      // Delete everything except settings
      return !key.includes('settings');
    });

    if (keysToDelete.length > 0) {
      await chrome.storage.local.remove(keysToDelete);
    }

    console.log('[ServiceWorker] Cache cleared, deleted:', keysToDelete.length, 'items');
    sendResponse({
      success: true,
      itemsDeleted: keysToDelete.length
    });

  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Helper: Get API key from storage
 */
async function getApiKey() {
  try {
    const storage = await chrome.storage.sync.get(CONFIG.STORAGE_KEYS.API_KEY);
    return storage[CONFIG.STORAGE_KEYS.API_KEY] || null;
  } catch (error) {
    console.error('[ServiceWorker] Error getting API key:', error);
    return null;
  }
}

/**
 * Helper: Simple hash function for cache keys
 */
function hashTitle(title) {
  // Simple hash to create cache key
  return 'movie_' + title.toLowerCase().replace(/\s+/g, '_').slice(0, 50);
}

/**
 * Helper: Update search history
 */
async function updateSearchHistory(title) {
  try {
    const settings = await chrome.storage.local.get(CONFIG.STORAGE_KEYS.SETTINGS);
    const current = settings[CONFIG.STORAGE_KEYS.SETTINGS] || { searchHistory: [] };

    // Add to history (max 50 items)
    const history = current.searchHistory || [];
    if (!history.includes(title)) {
      history.unshift(title);
      history.splice(50);

      current.searchHistory = history;
      await chrome.storage.local.set({
        [CONFIG.STORAGE_KEYS.SETTINGS]: current
      });
    }

  } catch (error) {
    console.error('[ServiceWorker] Error updating search history:', error);
  }
}

/**
 * Helper: Sleep utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Log service worker lifecycle
console.log('[ServiceWorker] Service worker initialized');
```

### src/content-script.js
```javascript
/**
 * Netflix Movie Info Extension - Content Script
 * Injected into Netflix pages to extract movie information
 */

console.log('[ContentScript] Loaded on Netflix');

// Configuration
const CONFIG = {
  TITLE_SELECTORS: [
    '[class*="title"]',
    '[data-test-id="hero-title"]',
    'h1',
    '[class*="hero"]'
  ],
  CHECK_INTERVAL_MS: 1000,
  MAX_TITLE_LENGTH: 200
};

let lastTitle = null;

/**
 * Extract movie title from page
 */
function extractMovieTitle() {
  for (const selector of CONFIG.TITLE_SELECTORS) {
    const element = document.querySelector(selector);
    if (element) {
      const text = element.textContent?.trim();
      if (text && text.length > 0 && text.length < CONFIG.MAX_TITLE_LENGTH) {
        return text;
      }
    }
  }
  return null;
}

/**
 * Check for title changes and fetch data
 */
function checkAndFetchTitle() {
  const currentTitle = extractMovieTitle();

  if (currentTitle && currentTitle !== lastTitle) {
    lastTitle = currentTitle;
    console.log('[ContentScript] New title detected:', currentTitle);
    fetchMovieData(currentTitle);
  }
}

/**
 * Send message to service worker to fetch movie data
 */
function fetchMovieData(title) {
  console.log('[ContentScript] Requesting movie data for:', title);

  chrome.runtime.sendMessage(
    { type: 'FETCH_MOVIE_DATA', title: title },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error('[ContentScript] Message error:', chrome.runtime.lastError);
        return;
      }

      if (response && response.success) {
        console.log('[ContentScript] Movie data received:', response.data);
        injectMovieInfo(response.data, response.fromCache);
      } else {
        console.warn('[ContentScript] Failed to fetch movie:', response?.error);
      }
    }
  );
}

/**
 * Inject movie info into page
 */
function injectMovieInfo(movieData, fromCache) {
  // Remove old info if exists
  const existingInfo = document.getElementById('netflix-movie-info-widget');
  if (existingInfo) {
    existingInfo.remove();
  }

  // Create info widget
  const widget = document.createElement('div');
  widget.id = 'netflix-movie-info-widget';
  widget.className = 'netflix-info-widget';
  widget.innerHTML = `
    <div class="netflix-info-content">
      <h3 class="netflix-info-title">${escapeHtml(movieData.title)}</h3>
      <div class="netflix-info-rating">
        <span class="rating-label">IMDb Rating:</span>
        <span class="rating-value">${movieData.imdbRating || 'N/A'}</span>
      </div>
      <div class="netflix-info-year">
        <span class="year-label">Year:</span>
        <span class="year-value">${movieData.year || 'N/A'}</span>
      </div>
      <div class="netflix-info-director">
        <span class="director-label">Director:</span>
        <span class="director-value">${escapeHtml(movieData.director || 'N/A')}</span>
      </div>
      <div class="netflix-info-genre">
        <span class="genre-label">Genre:</span>
        <span class="genre-value">${escapeHtml(movieData.genre || 'N/A')}</span>
      </div>
      <div class="netflix-info-plot">
        <p class="plot-text">${escapeHtml(movieData.plot || 'No plot available')}</p>
      </div>
      <div class="netflix-info-footer">
        ${fromCache ? '<small class="cache-label">From Cache</small>' : '<small class="fresh-label">Fresh</small>'}
      </div>
    </div>
  `;

  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    .netflix-info-widget {
      position: fixed;
      top: 80px;
      right: 20px;
      width: 350px;
      background: rgba(0, 0, 0, 0.95);
      color: #fff;
      border: 2px solid #e50914;
      border-radius: 8px;
      padding: 16px;
      font-family: Arial, sans-serif;
      z-index: 10000;
      box-shadow: 0 4px 15px rgba(229, 9, 20, 0.3);
    }

    .netflix-info-content h3 {
      margin: 0 0 12px 0;
      font-size: 18px;
      color: #e50914;
      word-wrap: break-word;
    }

    .netflix-info-content > div {
      margin-bottom: 8px;
      font-size: 14px;
      line-height: 1.4;
    }

    .netflix-info-content > div span:first-child {
      font-weight: bold;
      color: #ccc;
    }

    .netflix-info-content > div span:last-child {
      color: #fff;
      margin-left: 8px;
    }

    .netflix-info-plot {
      background: rgba(255, 255, 255, 0.05);
      padding: 10px;
      border-radius: 4px;
      margin-top: 10px;
    }

    .plot-text {
      margin: 0;
      font-size: 13px;
      line-height: 1.5;
      color: #ddd;
    }

    .netflix-info-footer {
      text-align: right;
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      font-size: 12px;
    }

    .cache-label {
      color: #ffc107;
    }

    .fresh-label {
      color: #4caf50;
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(widget);

  // Auto-remove after 10 seconds
  setTimeout(() => {
    widget.style.opacity = '0';
    widget.style.transition = 'opacity 0.3s';
    setTimeout(() => widget.remove(), 300);
  }, 10000);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// Start monitoring for title changes when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[ContentScript] Page ready, starting monitor');
    setInterval(checkAndFetchTitle, CONFIG.CHECK_INTERVAL_MS);
  });
} else {
  console.log('[ContentScript] Page already loaded, starting monitor');
  setInterval(checkAndFetchTitle, CONFIG.CHECK_INTERVAL_MS);
}

console.log('[ContentScript] Initialization complete');
```

### src/popup.html
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Netflix Movie Info</title>
  <link rel="stylesheet" href="../styles/popup.css">
</head>
<body>
  <div id="popup-container">
    <!-- Header -->
    <div class="popup-header">
      <h1 class="popup-title">Netflix Movie Info</h1>
      <div class="header-icons">
        <button id="settings-btn" class="icon-btn" title="Settings">⚙️</button>
        <button id="close-btn" class="icon-btn" title="Close">✕</button>
      </div>
    </div>

    <!-- Main Content -->
    <div id="popup-content" class="popup-content">
      <!-- Status Display -->
      <div id="status-section" class="status-section">
        <div id="api-status" class="status-item"></div>
      </div>

      <!-- Movie Info Display (if on Netflix) -->
      <div id="movie-info" class="movie-info" style="display: none;">
        <div class="loading">Loading movie info...</div>
      </div>

      <!-- Not on Netflix -->
      <div id="not-netflix" class="not-netflix" style="display: none;">
        <p>Please navigate to netflix.com to use this extension</p>
      </div>

      <!-- Settings Panel -->
      <div id="settings-panel" class="settings-panel" style="display: none;">
        <div class="settings-header">
          <h2>Settings</h2>
          <button id="back-btn" class="icon-btn">← Back</button>
        </div>

        <div class="settings-content">
          <div class="setting-item">
            <label for="api-key-input">OMDb API Key:</label>
            <input
              type="password"
              id="api-key-input"
              class="setting-input"
              placeholder="Enter your OMDb API key"
            >
            <small class="help-text">
              Get free API key at <a href="https://www.omdbapi.com/apikey.aspx" target="_blank">omdbapi.com</a>
            </small>
          </div>

          <div class="setting-buttons">
            <button id="save-key-btn" class="btn btn-primary">Save API Key</button>
            <button id="clear-cache-btn" class="btn btn-secondary">Clear Cache</button>
          </div>

          <div id="settings-message" class="settings-message"></div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="popup-footer">
      <small>Version: 1.0.0</small>
    </div>
  </div>

  <script src="popup.js"></script>
</body>
</html>
```

### src/popup.js
```javascript
/**
 * Netflix Movie Info Extension - Popup Script
 */

// DOM Elements
const elements = {
  statusSection: document.getElementById('status-section'),
  apiStatus: document.getElementById('api-status'),
  movieInfo: document.getElementById('movie-info'),
  notNetflix: document.getElementById('not-netflix'),
  settingsPanel: document.getElementById('settings-panel'),
  settingsBtn: document.getElementById('settings-btn'),
  closeBtn: document.getElementById('close-btn'),
  backBtn: document.getElementById('back-btn'),
  apiKeyInput: document.getElementById('api-key-input'),
  saveKeyBtn: document.getElementById('save-key-btn'),
  clearCacheBtn: document.getElementById('clear-cache-btn'),
  settingsMessage: document.getElementById('settings-message')
};

// Event listeners
elements.settingsBtn.addEventListener('click', showSettings);
elements.closeBtn.addEventListener('click', closePopup);
elements.backBtn.addEventListener('click', hideSettings);
elements.saveKeyBtn.addEventListener('click', saveApiKey);
elements.clearCacheBtn.addEventListener('click', clearCache);

/**
 * Initialize popup
 */
async function initPopup() {
  try {
    // Check API key status
    await checkApiKeyStatus();

    // Check if on Netflix
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const isNetflix = tab.url?.includes('netflix.com');

    if (!isNetflix) {
      elements.notNetflix.style.display = 'block';
      return;
    }

    elements.movieInfo.style.display = 'block';

    // Load and display current movie (if any)
    loadCurrentMovieInfo();

  } catch (error) {
    console.error('Error initializing popup:', error);
    showMessage('Error loading popup', 'error');
  }
}

/**
 * Check API key configuration
 */
async function checkApiKeyStatus() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_API_KEY_STATUS'
    });

    if (response.success) {
      if (response.configured) {
        elements.apiStatus.innerHTML = `
          <span class="status-good">✓ API Key Configured</span>
        `;
        elements.apiStatus.className = 'status-item status-good';
      } else {
        elements.apiStatus.innerHTML = `
          <span class="status-warning">⚠ API Key Not Configured</span>
          <p class="status-hint">Go to Settings to add your OMDb API key</p>
        `;
        elements.apiStatus.className = 'status-item status-warning';
      }
    }
  } catch (error) {
    console.error('Error checking API key:', error);
  }
}

/**
 * Load current movie info from cache
 */
async function loadCurrentMovieInfo() {
  try {
    // This would get the current movie from the content script
    // For now, show a placeholder
    elements.movieInfo.innerHTML = `
      <div class="movie-info-placeholder">
        <p>Movie information will appear here when you hover over a title on Netflix</p>
      </div>
    `;

  } catch (error) {
    console.error('Error loading movie info:', error);
  }
}

/**
 * Show settings panel
 */
function showSettings() {
  elements.settingsPanel.style.display = 'block';
  elements.movieInfo.style.display = 'none';
  elements.notNetflix.style.display = 'none';
  elements.statusSection.style.display = 'none';

  // Load current API key
  chrome.storage.sync.get('omdbApiKey', (result) => {
    if (result.omdbApiKey) {
      elements.apiKeyInput.value = result.omdbApiKey;
    }
  });
}

/**
 * Hide settings panel
 */
function hideSettings() {
  elements.settingsPanel.style.display = 'none';
  elements.movieInfo.style.display = 'block';
  elements.notNetflix.style.display = 'block';
  elements.statusSection.style.display = 'block';
  elements.settingsMessage.innerHTML = '';
  checkApiKeyStatus();
}

/**
 * Save API key
 */
async function saveApiKey() {
  const apiKey = elements.apiKeyInput.value.trim();

  if (!apiKey) {
    showSettingsMessage('Please enter an API key', 'error');
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'SET_API_KEY',
      apiKey: apiKey
    });

    if (response.success) {
      showSettingsMessage('API key saved successfully!', 'success');
      setTimeout(() => hideSettings(), 1500);
    } else {
      showSettingsMessage(response.error || 'Failed to save', 'error');
    }
  } catch (error) {
    console.error('Error saving API key:', error);
    showSettingsMessage('Error saving API key', 'error');
  }
}

/**
 * Clear movie cache
 */
async function clearCache() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'CLEAR_CACHE'
    });

    if (response.success) {
      showSettingsMessage(`Cache cleared (${response.itemsDeleted} items)`, 'success');
    } else {
      showSettingsMessage(response.error || 'Failed to clear cache', 'error');
    }
  } catch (error) {
    console.error('Error clearing cache:', error);
    showSettingsMessage('Error clearing cache', 'error');
  }
}

/**
 * Show message in settings
 */
function showSettingsMessage(message, type) {
  elements.settingsMessage.textContent = message;
  elements.settingsMessage.className = `settings-message ${type}`;
}

/**
 * Close popup
 */
function closePopup() {
  window.close();
}

/**
 * Show message (generic)
 */
function showMessage(message, type) {
  elements.statusSection.innerHTML = `
    <div class="status-item ${type}">
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// Initialize when popup opens
initPopup();
```

### styles/popup.css
```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  width: 400px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
  background-color: #141414;
  color: #fff;
}

#popup-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

/* Header */
.popup-header {
  background: linear-gradient(135deg, #000 0%, #1a1a1a 100%);
  border-bottom: 2px solid #e50914;
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.popup-title {
  font-size: 18px;
  font-weight: bold;
  color: #e50914;
  margin: 0;
}

.header-icons {
  display: flex;
  gap: 8px;
}

.icon-btn {
  background: none;
  border: none;
  color: #fff;
  font-size: 18px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.icon-btn:hover {
  background-color: rgba(229, 9, 20, 0.2);
}

/* Content */
.popup-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

/* Status */
.status-section {
  margin-bottom: 16px;
}

.status-item {
  padding: 12px;
  border-radius: 6px;
  font-size: 14px;
  line-height: 1.5;
}

.status-item.status-good {
  background-color: rgba(76, 175, 80, 0.15);
  color: #4caf50;
  border-left: 3px solid #4caf50;
}

.status-item.status-warning {
  background-color: rgba(255, 193, 7, 0.15);
  color: #ffc107;
  border-left: 3px solid #ffc107;
}

.status-item.status-error {
  background-color: rgba(244, 67, 54, 0.15);
  color: #f44336;
  border-left: 3px solid #f44336;
}

.status-hint {
  font-size: 12px;
  margin-top: 6px;
  opacity: 0.8;
}

/* Movie Info */
.movie-info {
  min-height: 100px;
}

.movie-info-placeholder {
  padding: 20px;
  text-align: center;
  color: #888;
  font-size: 14px;
}

.loading {
  padding: 20px;
  text-align: center;
  color: #e50914;
}

.not-netflix {
  padding: 20px;
  text-align: center;
  color: #888;
}

/* Settings */
.settings-panel {
  display: flex;
  flex-direction: column;
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.settings-header h2 {
  font-size: 16px;
  margin: 0;
}

.settings-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.setting-item label {
  font-size: 13px;
  font-weight: 500;
  color: #ddd;
}

.setting-input {
  padding: 8px 12px;
  border: 1px solid #444;
  border-radius: 4px;
  background-color: #222;
  color: #fff;
  font-size: 13px;
}

.setting-input:focus {
  outline: none;
  border-color: #e50914;
  box-shadow: 0 0 0 2px rgba(229, 9, 20, 0.2);
}

.help-text {
  font-size: 11px;
  color: #888;
}

.help-text a {
  color: #e50914;
  text-decoration: none;
}

.help-text a:hover {
  text-decoration: underline;
}

.setting-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.btn {
  flex: 1;
  min-width: 120px;
  padding: 8px 12px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background-color: #e50914;
  color: #fff;
}

.btn-primary:hover {
  background-color: #cc0812;
  box-shadow: 0 2px 8px rgba(229, 9, 20, 0.4);
}

.btn-secondary {
  background-color: #444;
  color: #fff;
}

.btn-secondary:hover {
  background-color: #555;
}

.settings-message {
  padding: 10px;
  border-radius: 4px;
  font-size: 13px;
  text-align: center;
}

.settings-message.success {
  background-color: rgba(76, 175, 80, 0.2);
  color: #4caf50;
}

.settings-message.error {
  background-color: rgba(244, 67, 54, 0.2);
  color: #f44336;
}

/* Footer */
.popup-footer {
  padding: 12px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  text-align: center;
  font-size: 11px;
  color: #666;
}

/* Scrollbar styling */
.popup-content::-webkit-scrollbar {
  width: 8px;
}

.popup-content::-webkit-scrollbar-track {
  background: transparent;
}

.popup-content::-webkit-scrollbar-thumb {
  background-color: #555;
  border-radius: 4px;
}

.popup-content::-webkit-scrollbar-thumb:hover {
  background-color: #666;
}
```

---

## Template 2: Minimal Configuration

For a simpler extension that doesn't need API integration:

### Simple manifest.json
```json
{
  "manifest_version": 3,
  "name": "Simple Netflix Extension",
  "version": "1.0.0",
  "description": "Simple Netflix enhancement",
  "permissions": ["activeTab", "scripting"],
  "action": {
    "default_title": "Click to enhance Netflix"
  },
  "background": {
    "service_worker": "src/service-worker.js"
  },
  "icons": {
    "128": "images/icon-128.png"
  }
}
```

### Simple service-worker.js
```javascript
// Minimal service worker - just handles action clicks
chrome.action.onClicked.addListener((tab) => {
  if (!tab.url.includes('netflix.com')) {
    console.log('Not on Netflix');
    return;
  }

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      alert('Netflix enhancement active!');
    }
  });
});
```

---

## Common Patterns

### Pattern 1: Sending Data from Content Script to Service Worker

```javascript
// content-script.js
const movieTitle = document.querySelector('.title').textContent;

chrome.runtime.sendMessage(
  { type: 'MOVIE_FOUND', title: movieTitle },
  (response) => {
    console.log('Service worker response:', response);
  }
);

// service-worker.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'MOVIE_FOUND') {
    console.log('Movie found:', request.title);
    sendResponse({ received: true });
  }
});
```

### Pattern 2: Long-Lived Connection

```javascript
// content-script.js
const port = chrome.runtime.connect({ name: 'netflix-channel' });

port.onMessage.addListener((msg) => {
  console.log('Message from service worker:', msg);
});

port.postMessage({ action: 'ping' });

// service-worker.js
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'netflix-channel') {
    port.onMessage.addListener((msg) => {
      console.log('Message from content script:', msg);
      port.postMessage({ pong: true });
    });
  }
});
```

### Pattern 3: One-Time Storage Set/Get

```javascript
// Save to storage
chrome.storage.local.set({
  'watched_movies': ['Inception', 'Interstellar']
});

// Get from storage
chrome.storage.local.get('watched_movies', (result) => {
  console.log('Watched:', result.watched_movies);
});

// Clear storage
chrome.storage.local.clear();
```

---

This document provides production-ready templates for building Chrome Extension Manifest V3 extensions.
