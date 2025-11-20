/**
 * CacheManager - Unified cache management with persistent storage
 * Provides a single source of truth for cache operations across the extension
 * Implements both in-memory and persistent caching strategies
 */

class CacheManager {
  /**
   * Initialize CacheManager
   * @param {string} storageKey - Key for chrome.storage.local (default: 'netflix_ratings_cache')
   * @param {string} durationKey - Key for cache duration setting (default: 'cacheDurationHours')
   */
  constructor(storageKey = 'netflix_ratings_cache', durationKey = 'cacheDurationHours') {
    this.storageKey = storageKey;
    this.durationKey = durationKey;
    this.memoryCache = new Map(); // Fallback in-memory cache
    this.initialized = false;

    console.log('[CacheManager] Initialized with storageKey:', storageKey, 'durationKey:', durationKey);
  }

  /**
   * Initialize cache manager - loads cache duration preference
   * @returns {Promise<void>}
   */
  async init() {
    try {
      console.log('[CacheManager] Initializing cache manager...');

      // Verify chrome.storage is available
      if (!chrome.storage || !chrome.storage.sync) {
        throw new Error('chrome.storage.sync not available');
      }

      this.initialized = true;
      const duration = await this.getCacheDuration();
      console.log('[CacheManager] Cache manager initialized. Duration:', duration, 'hours');
    } catch (error) {
      console.error('[CacheManager] Initialization error:', error.message);
      throw error;
    }
  }

  /**
   * Get cache duration in milliseconds
   * Falls back to 24 hours if not configured
   * @returns {Promise<number>} Duration in milliseconds
   */
  async getCacheDurationMs() {
    try {
      const hours = await this.getCacheDuration();
      const ms = hours * 60 * 60 * 1000;
      console.log('[CacheManager] Cache duration in ms:', ms, `(${hours}h)`);
      return ms;
    } catch (error) {
      console.error('[CacheManager] Error getting cache duration:', error.message);
      // Default fallback
      const defaultMs = 24 * 60 * 60 * 1000;
      console.log('[CacheManager] Using default cache duration:', defaultMs, 'ms (24h)');
      return defaultMs;
    }
  }

  /**
   * Get cache duration in hours
   * @returns {Promise<number>} Duration in hours
   */
  async getCacheDuration() {
    try {
      const result = await chrome.storage.sync.get([this.durationKey]);
      const duration = result[this.durationKey] || 24;
      console.log('[CacheManager] Retrieved cache duration:', duration, 'hours');
      return duration;
    } catch (error) {
      console.error('[CacheManager] Error getting cache duration:', error.message);
      return 24; // Default 24 hours
    }
  }

  /**
   * Set cache duration in hours
   * @param {number} hours - Duration in hours
   * @returns {Promise<void>}
   */
  async setCacheDuration(hours) {
    try {
      if (!Number.isInteger(hours) || hours <= 0) {
        throw new Error('Cache duration must be a positive integer');
      }

      console.log('[CacheManager] Setting cache duration to:', hours, 'hours');
      await chrome.storage.sync.set({ [this.durationKey]: hours });
      console.log('[CacheManager] Cache duration saved successfully');
    } catch (error) {
      console.error('[CacheManager] Error setting cache duration:', error.message);
      throw error;
    }
  }

  /**
   * Get item from cache (checks persistent storage first, then memory)
   * @param {string} key - Cache key
   * @returns {Promise<any|null>} Cached data or null if expired/missing
   */
  async get(key) {
    try {
      if (!this.initialized) {
        console.warn('[CacheManager] Cache manager not initialized. Initializing...');
        await this.init();
      }

      // Try persistent storage first
      try {
        const result = await chrome.storage.local.get([this.storageKey]);
        const cache = result[this.storageKey] || {};

        if (cache[key]) {
          const isValid = await this._isEntryValid(cache[key]);
          if (isValid) {
            console.log('[CacheManager] Cache hit (persistent):', key);
            return cache[key].data;
          } else {
            console.log('[CacheManager] Cache expired (persistent):', key);
            // Remove expired entry
            delete cache[key];
            await chrome.storage.local.set({ [this.storageKey]: cache });
            return null;
          }
        }
      } catch (error) {
        console.warn('[CacheManager] Error accessing persistent cache:', error.message);
      }

      // Fall back to memory cache
      const cached = this.memoryCache.get(key);
      if (cached) {
        const isValid = await this._isEntryValid(cached);
        if (isValid) {
          console.log('[CacheManager] Cache hit (memory):', key);
          return cached.data;
        } else {
          console.log('[CacheManager] Cache expired (memory):', key);
          this.memoryCache.delete(key);
          return null;
        }
      }

      console.log('[CacheManager] Cache miss:', key);
      return null;
    } catch (error) {
      console.error('[CacheManager] Error getting cache item:', error.message);
      return null;
    }
  }

  /**
   * Set item in cache (both persistent and memory)
   * @param {string} key - Cache key
   * @param {any} data - Data to cache
   * @returns {Promise<void>}
   */
  async set(key, data) {
    try {
      if (!this.initialized) {
        console.warn('[CacheManager] Cache manager not initialized. Initializing...');
        await this.init();
      }

      const entry = {
        data,
        timestamp: Date.now(),
      };

      // Store in memory cache
      this.memoryCache.set(key, entry);
      console.log('[CacheManager] Cached to memory:', key, 'Memory cache size:', this.memoryCache.size);

      // Store in persistent cache
      try {
        const result = await chrome.storage.local.get([this.storageKey]);
        const cache = result[this.storageKey] || {};
        cache[key] = entry;

        // Limit cache size to prevent excessive storage usage
        if (Object.keys(cache).length > 500) {
          console.warn('[CacheManager] Cache size exceeds 500 items. Cleaning up oldest entries...');
          await this._cleanupOldestEntries(cache, 250);
        }

        await chrome.storage.local.set({ [this.storageKey]: cache });
        console.log('[CacheManager] Cached to persistent storage:', key, 'Total items:', Object.keys(cache).length);
      } catch (error) {
        console.warn('[CacheManager] Error saving to persistent cache:', error.message);
        // Continue without persistent cache - memory cache still works
      }
    } catch (error) {
      console.error('[CacheManager] Error setting cache item:', error.message);
      throw error;
    }
  }

  /**
   * Clear all cache (both persistent and memory)
   * @returns {Promise<void>}
   */
  async clear() {
    try {
      console.log('[CacheManager] Clearing cache...');

      // Clear memory cache
      const memorySize = this.memoryCache.size;
      this.memoryCache.clear();
      console.log('[CacheManager] Cleared memory cache. Items removed:', memorySize);

      // Clear persistent cache
      try {
        await chrome.storage.local.set({ [this.storageKey]: {} });
        console.log('[CacheManager] Cleared persistent cache');
      } catch (error) {
        console.warn('[CacheManager] Error clearing persistent cache:', error.message);
      }
    } catch (error) {
      console.error('[CacheManager] Error clearing cache:', error.message);
      throw error;
    }
  }

  /**
   * Get cache statistics
   * @returns {Promise<Object>} Cache stats including item count, size estimate, duration
   */
  async getStats() {
    try {
      if (!this.initialized) {
        await this.init();
      }

      let totalItems = this.memoryCache.size;
      let persistentItems = 0;
      let sizeEstimate = 0;

      // Get persistent cache stats
      try {
        const result = await chrome.storage.local.get([this.storageKey]);
        const cache = result[this.storageKey] || {};
        persistentItems = Object.keys(cache).length;
        totalItems = Math.max(totalItems, persistentItems); // Use persistent if available

        // Rough size estimate in bytes
        sizeEstimate = JSON.stringify(cache).length;
      } catch (error) {
        console.warn('[CacheManager] Error getting persistent cache stats:', error.message);
      }

      const duration = await this.getCacheDuration();

      const stats = {
        totalItems,
        memoryItems: this.memoryCache.size,
        persistentItems,
        sizeEstimateBytes: sizeEstimate,
        sizeEstimateKb: Math.round(sizeEstimate / 1024),
        cacheDurationHours: duration,
      };

      console.log('[CacheManager] Cache stats:', stats);
      return stats;
    } catch (error) {
      console.error('[CacheManager] Error getting cache stats:', error.message);
      return {
        totalItems: 0,
        memoryItems: 0,
        persistentItems: 0,
        sizeEstimateBytes: 0,
        sizeEstimateKb: 0,
        cacheDurationHours: 24,
      };
    }
  }

  /**
   * Get detailed cache info (for debugging)
   * @returns {Promise<Array>} Array of cache entries with metadata
   */
  async getDetailedInfo() {
    try {
      const result = await chrome.storage.local.get([this.storageKey]);
      const cache = result[this.storageKey] || {};
      const durationMs = await this.getCacheDurationMs();
      const now = Date.now();

      const entries = Object.entries(cache).map(([key, entry]) => {
        const age = now - entry.timestamp;
        const isExpired = age > durationMs;
        return {
          key,
          ageMs: age,
          ageHours: Math.round(age / (60 * 60 * 1000) * 10) / 10,
          isExpired,
          timestampMs: entry.timestamp,
        };
      });

      console.log('[CacheManager] Detailed cache info:', entries);
      return entries;
    } catch (error) {
      console.error('[CacheManager] Error getting detailed cache info:', error.message);
      return [];
    }
  }

  /**
   * Cleanup expired entries from cache
   * @returns {Promise<number>} Number of entries removed
   */
  async cleanupExpired() {
    try {
      console.log('[CacheManager] Starting cleanup of expired entries...');
      const durationMs = await this.getCacheDurationMs();
      const now = Date.now();
      let removedCount = 0;

      // Clean memory cache
      for (const [key, entry] of this.memoryCache.entries()) {
        if (now - entry.timestamp > durationMs) {
          this.memoryCache.delete(key);
          removedCount++;
        }
      }

      // Clean persistent cache
      try {
        const result = await chrome.storage.local.get([this.storageKey]);
        const cache = result[this.storageKey] || {};
        let persistentRemoved = 0;

        for (const [key, entry] of Object.entries(cache)) {
          if (now - entry.timestamp > durationMs) {
            delete cache[key];
            persistentRemoved++;
          }
        }

        if (persistentRemoved > 0) {
          await chrome.storage.local.set({ [this.storageKey]: cache });
          removedCount += persistentRemoved;
        }
      } catch (error) {
        console.warn('[CacheManager] Error cleaning persistent cache:', error.message);
      }

      console.log('[CacheManager] Cleanup complete. Entries removed:', removedCount);
      return removedCount;
    } catch (error) {
      console.error('[CacheManager] Error during cleanup:', error.message);
      return 0;
    }
  }

  /**
   * Check if cache entry is still valid
   * @private
   * @param {Object} entry - Cache entry with data and timestamp
   * @returns {Promise<boolean>} True if entry is valid, false if expired
   */
  async _isEntryValid(entry) {
    try {
      const durationMs = await this.getCacheDurationMs();
      const now = Date.now();
      const age = now - entry.timestamp;
      const isValid = age <= durationMs;

      if (!isValid) {
        console.log('[CacheManager] Entry validation failed. Age:', age, 'ms, Duration:', durationMs, 'ms');
      }

      return isValid;
    } catch (error) {
      console.error('[CacheManager] Error validating entry:', error.message);
      return false;
    }
  }

  /**
   * Remove oldest entries from cache to maintain size limit
   * @private
   * @param {Object} cache - Cache object
   * @param {number} targetSize - Target number of entries to remove to
   * @returns {Promise<void>}
   */
  async _cleanupOldestEntries(cache, targetSize) {
    try {
      const entries = Object.entries(cache)
        .sort((a, b) => a[1].timestamp - b[1].timestamp)
        .slice(0, Object.keys(cache).length - targetSize);

      const removedKeys = entries.map(([key]) => key);
      removedKeys.forEach(key => delete cache[key]);

      console.log('[CacheManager] Removed oldest entries:', removedKeys.length);
    } catch (error) {
      console.error('[CacheManager] Error during oldest entries cleanup:', error.message);
    }
  }
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CacheManager;
}
