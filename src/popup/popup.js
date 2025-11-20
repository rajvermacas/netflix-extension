/**
 * Netflix Ratings Extension - Popup Script
 *
 * Handles popup UI interactions and settings management
 */

console.log('[Popup] Script loaded');

// DOM Elements
const apiKeyInput = document.getElementById('api-key');
const saveApiKeyButton = document.getElementById('save-api-key');
const clearCacheButton = document.getElementById('clear-cache');
const cacheSizeElement = document.getElementById('cache-size');
const statusElement = document.getElementById('status');

/**
 * Initialize popup
 */
async function init() {
  console.log('[Popup] Initializing');

  // Load saved API key
  await loadApiKey();

  // Load cache stats
  await loadCacheStats();

  // Set up event listeners
  setupEventListeners();

  console.log('[Popup] Initialization complete');
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  console.log('[Popup] Setting up event listeners');

  saveApiKeyButton.addEventListener('click', handleSaveApiKey);
  clearCacheButton.addEventListener('click', handleClearCache);

  // Save on Enter key
  apiKeyInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleSaveApiKey();
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
 * Load cache statistics
 */
async function loadCacheStats() {
  console.log('[Popup] Loading cache stats');

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_CACHE_STATS',
    });

    if (response && response.success) {
      const size = response.stats.size || 0;
      cacheSizeElement.textContent = size;
      console.log('[Popup] Cache stats loaded:', size, 'items');
    } else {
      console.log('[Popup] Failed to load cache stats');
      cacheSizeElement.textContent = '0';
    }
  } catch (error) {
    console.error('[Popup] Error loading cache stats:', error);
    cacheSizeElement.textContent = '-';
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
