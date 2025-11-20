/**
 * Netflix Ratings Extension - Popup Script
 *
 * Handles popup UI interactions, settings management, and cache configuration
 */

console.log('[Popup] Script loaded');

// DOM Elements
const apiKeyInput = document.getElementById('api-key');
const saveApiKeyButton = document.getElementById('save-api-key');
const clearCacheButton = document.getElementById('clear-cache');
const cacheSizeElement = document.getElementById('cache-size');
const cacheSizeKbElement = document.getElementById('cache-size-kb');
const currentDurationElement = document.getElementById('current-duration');
const statusElement = document.getElementById('status');

// Cache duration elements
const cacheDurationSelect = document.getElementById('cache-duration-select');
const customDurationContainer = document.getElementById('custom-duration-container');
const customDurationInput = document.getElementById('custom-duration-input');
const saveCacheDurationButton = document.getElementById('save-cache-duration');

/**
 * Initialize popup
 */
async function init() {
  console.log('[Popup] Initializing');

  try {
    // Load saved API key
    await loadApiKey();

    // Load cache duration setting
    await loadCacheDurationSetting();

    // Load cache stats
    await loadCacheStats();

    // Set up event listeners
    setupEventListeners();

    console.log('[Popup] Initialization complete');
  } catch (error) {
    console.error('[Popup] Initialization error:', error);
    showStatus('Error initializing popup', 'error');
  }
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  console.log('[Popup] Setting up event listeners');

  saveApiKeyButton.addEventListener('click', handleSaveApiKey);
  clearCacheButton.addEventListener('click', handleClearCache);
  cacheDurationSelect.addEventListener('change', handleDurationSelectChange);
  saveCacheDurationButton.addEventListener('click', handleSaveCacheDuration);

  // Save on Enter key
  apiKeyInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleSaveApiKey();
    }
  });

  // Save custom duration on Enter key
  customDurationInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleSaveCacheDuration();
    }
  });
}

/**
 * Load saved API key from storage
 */
async function loadApiKey() {
  console.log('[Popup] Loading API key from storage');

  try {
    const result = await chrome.storage.sync.get(['omdbApiKey']);

    if (result.omdbApiKey) {
      apiKeyInput.value = result.omdbApiKey;
      console.log('[Popup] API key loaded successfully');
    } else {
      console.log('[Popup] No API key found in storage');
    }
  } catch (error) {
    console.error('[Popup] Error loading API key:', error);
    showStatus('Error loading API key', 'error');
  }
}

/**
 * Load cache duration setting from storage
 */
async function loadCacheDurationSetting() {
  console.log('[Popup] Loading cache duration setting');

  try {
    const result = await chrome.storage.sync.get(['cacheDurationHours']);
    const duration = result.cacheDurationHours || 24;

    console.log('[Popup] Cache duration setting loaded:', duration, 'hours');

    // Map common durations to select options
    const durationMap = {
      1: '1',
      6: '6',
      12: '12',
      24: '24',
      168: '168', // 7 days
      720: '720', // 30 days
    };

    if (durationMap[duration]) {
      cacheDurationSelect.value = durationMap[duration];
    } else {
      // Set to custom for non-standard durations
      cacheDurationSelect.value = 'custom';
      customDurationInput.value = duration;
      customDurationContainer.style.display = 'block';
    }

    updateCurrentDurationDisplay(duration);
  } catch (error) {
    console.error('[Popup] Error loading cache duration:', error);
    showStatus('Error loading cache duration setting', 'error');
    // Default to 24 hours
    cacheDurationSelect.value = '24';
    updateCurrentDurationDisplay(24);
  }
}

/**
 * Update the current duration display
 * @param {number} hours - Duration in hours
 */
function updateCurrentDurationDisplay(hours) {
  console.log('[Popup] Updating current duration display:', hours, 'hours');

  let displayText;
  if (hours < 24) {
    displayText = `${hours} hour${hours !== 1 ? 's' : ''}`;
  } else if (hours === 24) {
    displayText = '1 day';
  } else if (hours % 168 === 0) {
    const days = hours / 168;
    displayText = `${days} day${days !== 1 ? 's' : ''}`;
  } else if (hours % 24 === 0) {
    const days = hours / 24;
    displayText = `${days} day${days !== 1 ? 's' : ''}`;
  } else {
    displayText = `${hours} hours`;
  }

  currentDurationElement.textContent = displayText;
}

/**
 * Handle cache duration select change
 */
function handleDurationSelectChange() {
  const value = cacheDurationSelect.value;
  console.log('[Popup] Cache duration select changed:', value);

  if (value === 'custom') {
    customDurationContainer.style.display = 'block';
    customDurationInput.focus();
  } else {
    customDurationContainer.style.display = 'none';
  }
}

/**
 * Load cache statistics
 */
async function loadCacheStats() {
  console.log('[Popup] Loading cache stats');

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_CACHE_STATS',
    });

    if (response && response.success && response.stats) {
      const stats = response.stats;

      // Update cached items count
      const totalItems = stats.totalItems || 0;
      cacheSizeElement.textContent = totalItems;
      console.log('[Popup] Cached items:', totalItems);

      // Update cache size in KB
      const sizeKb = stats.sizeEstimateKb || 0;
      if (sizeKb > 0) {
        cacheSizeKbElement.textContent = `${sizeKb} KB`;
      } else if (totalItems > 0) {
        cacheSizeKbElement.textContent = '< 1 KB';
      } else {
        cacheSizeKbElement.textContent = '0 KB';
      }
      console.log('[Popup] Cache size:', sizeKb, 'KB');

      // Update current duration if returned from service worker
      if (stats.cacheDurationHours) {
        updateCurrentDurationDisplay(stats.cacheDurationHours);
      }
    } else {
      console.log('[Popup] Failed to load cache stats');
      cacheSizeElement.textContent = '0';
      cacheSizeKbElement.textContent = '0 KB';
    }
  } catch (error) {
    console.error('[Popup] Error loading cache stats:', error);
    cacheSizeElement.textContent = '-';
    cacheSizeKbElement.textContent = '-';
  }
}

/**
 * Handle save cache duration button click
 */
async function handleSaveCacheDuration() {
  console.log('[Popup] Saving cache duration');

  let durationHours;

  const selectValue = cacheDurationSelect.value;

  if (selectValue === 'custom') {
    const customValue = customDurationInput.value.trim();

    if (!customValue) {
      console.log('[Popup] Custom duration is empty');
      showStatus('Please enter a duration value', 'error');
      return;
    }

    durationHours = parseInt(customValue, 10);

    if (isNaN(durationHours) || durationHours <= 0) {
      console.log('[Popup] Invalid custom duration:', customValue);
      showStatus('Duration must be a positive number', 'error');
      return;
    }

    if (durationHours > 8760) {
      console.log('[Popup] Duration too large:', durationHours);
      showStatus('Duration cannot exceed 1 year (8760 hours)', 'error');
      return;
    }
  } else {
    durationHours = parseInt(selectValue, 10);

    if (isNaN(durationHours) || durationHours <= 0) {
      console.log('[Popup] Invalid select value:', selectValue);
      showStatus('Invalid duration selected', 'error');
      return;
    }
  }

  // Disable button during save
  saveCacheDurationButton.disabled = true;
  saveCacheDurationButton.textContent = 'Saving...';

  try {
    console.log('[Popup] Setting cache duration to:', durationHours, 'hours');

    // Save to storage
    await chrome.storage.sync.set({ cacheDurationHours: durationHours });
    console.log('[Popup] Cache duration saved successfully');

    // Notify service worker about duration change
    try {
      await chrome.runtime.sendMessage({
        type: 'CACHE_DURATION_CHANGED',
        duration: durationHours,
      });
      console.log('[Popup] Service worker notified about duration change');
    } catch (err) {
      console.warn('[Popup] Could not notify service worker:', err.message);
    }

    // Update display
    updateCurrentDurationDisplay(durationHours);

    showStatus(`Cache duration set to ${durationHours} hour${durationHours !== 1 ? 's' : ''}!`, 'success');
    saveCacheDurationButton.textContent = 'Saved ✓';

    // Reset button after delay
    setTimeout(() => {
      saveCacheDurationButton.textContent = 'Save Duration';
      saveCacheDurationButton.disabled = false;
    }, 2000);
  } catch (error) {
    console.error('[Popup] Error saving cache duration:', error);
    showStatus('Error saving cache duration', 'error');

    saveCacheDurationButton.textContent = 'Save Duration';
    saveCacheDurationButton.disabled = false;
  }
}

/**
 * Handle save API key button click
 */
async function handleSaveApiKey() {
  console.log('[Popup] Saving API key');

  const apiKey = apiKeyInput.value.trim();

  if (!apiKey) {
    console.log('[Popup] API key is empty');
    showStatus('Please enter an API key', 'error');
    return;
  }

  // Validate API key format (basic check)
  if (apiKey.length < 8) {
    console.log('[Popup] API key too short');
    showStatus('API key seems invalid (too short)', 'error');
    return;
  }

  // Disable button during save
  saveApiKeyButton.disabled = true;
  saveApiKeyButton.textContent = 'Saving...';

  try {
    // Save to storage
    await chrome.storage.sync.set({ omdbApiKey: apiKey });
    console.log('[Popup] API key saved successfully');

    showStatus('API key saved successfully!', 'success');
    saveApiKeyButton.textContent = 'Saved ✓';

    // Reset button after delay
    setTimeout(() => {
      saveApiKeyButton.textContent = 'Save API Key';
      saveApiKeyButton.disabled = false;
    }, 2000);
  } catch (error) {
    console.error('[Popup] Error saving API key:', error);
    showStatus('Error saving API key', 'error');

    saveApiKeyButton.textContent = 'Save API Key';
    saveApiKeyButton.disabled = false;
  }
}

/**
 * Handle clear cache button click
 */
async function handleClearCache() {
  console.log('[Popup] Clearing cache');

  // Disable button during operation
  clearCacheButton.disabled = true;
  clearCacheButton.textContent = 'Clearing...';

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'CLEAR_CACHE',
    });

    if (response && response.success) {
      const cleared = response.cleared || 0;
      console.log('[Popup] Cache cleared:', cleared, 'items');

      showStatus(`Cache cleared! Removed ${cleared} items`, 'success');
      cacheSizeElement.textContent = '0';
      cacheSizeKbElement.textContent = '0 KB';

      clearCacheButton.textContent = 'Cleared ✓';

      // Reset button after delay
      setTimeout(() => {
        clearCacheButton.textContent = 'Clear Cache';
        clearCacheButton.disabled = false;
      }, 2000);
    } else {
      console.log('[Popup] Failed to clear cache');
      showStatus('Error clearing cache', 'error');
      clearCacheButton.textContent = 'Clear Cache';
      clearCacheButton.disabled = false;
    }
  } catch (error) {
    console.error('[Popup] Error clearing cache:', error);
    showStatus('Error clearing cache', 'error');

    clearCacheButton.textContent = 'Clear Cache';
    clearCacheButton.disabled = false;
  }
}

/**
 * Show status message
 *
 * @param {string} message - Message to display
 * @param {string} type - Message type ('success', 'error', 'info')
 */
function showStatus(message, type = 'info') {
  console.log(`[Popup] Status [${type}]:`, message);

  // Clear existing classes
  statusElement.className = 'status-message';

  // Add new class
  statusElement.classList.add('show', type);
  statusElement.textContent = message;

  // Auto-hide after 5 seconds
  setTimeout(() => {
    statusElement.classList.remove('show');
  }, 5000);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
