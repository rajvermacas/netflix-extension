/**
 * Unit tests for CacheManager class
 * Tests persistent storage, in-memory caching, expiration, and duration configuration
 */

// Mock chrome.storage API
global.chrome = {
  storage: {
    sync: {
      get: jest.fn(),
      set: jest.fn(),
    },
    local: {
      get: jest.fn(),
      set: jest.fn(),
    },
  },
};

// Import CacheManager
const CacheManager = require('../../src/utils/cache-manager');

describe('CacheManager', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    // Reset Date.now()
    jest.useRealTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Initialization', () => {
    test('should initialize successfully with default parameters', async () => {
      const manager = new CacheManager();
      expect(manager.storageKey).toBe('netflix_ratings_cache');
      expect(manager.durationKey).toBe('cacheDurationHours');
      expect(manager.memoryCache).toEqual(new Map());
      expect(manager.initialized).toBe(false);
    });

    test('should initialize successfully with custom parameters', async () => {
      const manager = new CacheManager('custom_cache', 'custom_duration');
      expect(manager.storageKey).toBe('custom_cache');
      expect(manager.durationKey).toBe('custom_duration');
    });

    test('should call init() successfully', async () => {
      const manager = new CacheManager();
      chrome.storage.sync.get.mockResolvedValue({});

      await manager.init();
      expect(manager.initialized).toBe(true);
      expect(chrome.storage.sync.get).toHaveBeenCalled();
    });

    test('should throw error if chrome.storage not available', async () => {
      const originalStorage = global.chrome.storage;
      global.chrome.storage = null;

      const manager = new CacheManager();
      await expect(manager.init()).rejects.toThrow();

      global.chrome.storage = originalStorage;
    });
  });

  describe('Cache Duration Management', () => {
    test('should get cache duration from storage', async () => {
      const manager = new CacheManager();
      chrome.storage.sync.get.mockResolvedValue({ cacheDurationHours: 48 });

      const duration = await manager.getCacheDuration();
      expect(duration).toBe(48);
      expect(chrome.storage.sync.get).toHaveBeenCalledWith(['cacheDurationHours']);
    });

    test('should return default 24 hours if not configured', async () => {
      const manager = new CacheManager();
      chrome.storage.sync.get.mockResolvedValue({});

      const duration = await manager.getCacheDuration();
      expect(duration).toBe(24);
    });

    test('should convert cache duration to milliseconds correctly', async () => {
      const manager = new CacheManager();
      chrome.storage.sync.get.mockResolvedValue({ cacheDurationHours: 48 });

      const durationMs = await manager.getCacheDurationMs();
      expect(durationMs).toBe(48 * 60 * 60 * 1000);
    });

    test('should set cache duration and save to storage', async () => {
      const manager = new CacheManager();
      chrome.storage.sync.set.mockResolvedValue(undefined);

      await manager.setCacheDuration(72);
      expect(chrome.storage.sync.set).toHaveBeenCalledWith({ cacheDurationHours: 72 });
    });

    test('should reject invalid cache duration', async () => {
      const manager = new CacheManager();

      await expect(manager.setCacheDuration(-1)).rejects.toThrow('positive integer');
      await expect(manager.setCacheDuration(0)).rejects.toThrow('positive integer');
      await expect(manager.setCacheDuration(12.5)).rejects.toThrow('positive integer');
      await expect(manager.setCacheDuration('24')).rejects.toThrow('positive integer');
    });
  });

  describe('Cache Set and Get Operations', () => {
    test('should set item in memory cache', async () => {
      const manager = new CacheManager();
      chrome.storage.sync.get.mockResolvedValue({});
      chrome.storage.local.get.mockResolvedValue({});
      chrome.storage.local.set.mockResolvedValue(undefined);

      await manager.init();
      await manager.set('test_key', { title: 'Breaking Bad', rating: 9.5 });

      expect(manager.memoryCache.has('test_key')).toBe(true);
      const entry = manager.memoryCache.get('test_key');
      expect(entry.data).toEqual({ title: 'Breaking Bad', rating: 9.5 });
      expect(entry.timestamp).toBeDefined();
    });

    test('should set item in persistent cache', async () => {
      const manager = new CacheManager();
      chrome.storage.sync.get.mockResolvedValue({});
      chrome.storage.local.get.mockResolvedValue({});
      chrome.storage.local.set.mockResolvedValue(undefined);

      await manager.init();
      await manager.set('test_key', { title: 'Breaking Bad', rating: 9.5 });

      expect(chrome.storage.local.set).toHaveBeenCalled();
      const callArgs = chrome.storage.local.set.mock.calls[0][0];
      expect(callArgs.netflix_ratings_cache).toBeDefined();
      expect(callArgs.netflix_ratings_cache.test_key).toBeDefined();
    });

    test('should get item from cache (valid entry)', async () => {
      const manager = new CacheManager();
      const testData = { title: 'Breaking Bad', rating: 9.5 };
      const timestamp = Date.now();
      const cachedEntry = { data: testData, timestamp };

      chrome.storage.sync.get.mockResolvedValue({});
      chrome.storage.local.get.mockResolvedValue({
        netflix_ratings_cache: { test_key: cachedEntry },
      });

      await manager.init();
      const result = await manager.get('test_key');

      expect(result).toEqual(testData);
    });

    test('should return null for expired cache entry', async () => {
      const manager = new CacheManager();
      const testData = { title: 'Breaking Bad', rating: 9.5 };
      const oldTimestamp = Date.now() - 48 * 60 * 60 * 1000; // 48 hours ago
      const cachedEntry = { data: testData, timestamp: oldTimestamp };

      chrome.storage.sync.get.mockResolvedValue({ cacheDurationHours: 24 });
      chrome.storage.local.get.mockResolvedValue({
        netflix_ratings_cache: { test_key: cachedEntry },
      });
      chrome.storage.local.set.mockResolvedValue(undefined);

      await manager.init();
      const result = await manager.get('test_key');

      expect(result).toBeNull();
    });

    test('should return null for missing cache entry', async () => {
      const manager = new CacheManager();
      chrome.storage.sync.get.mockResolvedValue({});
      chrome.storage.local.get.mockResolvedValue({
        netflix_ratings_cache: {},
      });

      await manager.init();
      const result = await manager.get('nonexistent_key');

      expect(result).toBeNull();
    });

    test('should fall back to memory cache if persistent storage fails', async () => {
      const manager = new CacheManager();
      const testData = { title: 'Breaking Bad', rating: 9.5 };
      const timestamp = Date.now();

      chrome.storage.sync.get.mockResolvedValue({});
      chrome.storage.local.get.mockRejectedValue(new Error('Storage error'));

      await manager.init();
      manager.memoryCache.set('test_key', { data: testData, timestamp });
      const result = await manager.get('test_key');

      expect(result).toEqual(testData);
    });
  });

  describe('Cache Clear Operation', () => {
    test('should clear memory cache', async () => {
      const manager = new CacheManager();
      chrome.storage.sync.get.mockResolvedValue({});
      chrome.storage.local.get.mockResolvedValue({});
      chrome.storage.local.set.mockResolvedValue(undefined);

      await manager.init();
      manager.memoryCache.set('key1', { data: 'value1', timestamp: Date.now() });
      manager.memoryCache.set('key2', { data: 'value2', timestamp: Date.now() });

      await manager.clear();

      expect(manager.memoryCache.size).toBe(0);
    });

    test('should clear persistent cache', async () => {
      const manager = new CacheManager();
      chrome.storage.sync.get.mockResolvedValue({});
      chrome.storage.local.get.mockResolvedValue({});
      chrome.storage.local.set.mockResolvedValue(undefined);

      await manager.init();
      await manager.clear();

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        netflix_ratings_cache: {},
      });
    });
  });

  describe('Cache Statistics', () => {
    test('should return cache statistics', async () => {
      const manager = new CacheManager();
      const cacheData = {
        netflix_ratings_cache: {
          key1: { data: { title: 'Breaking Bad' }, timestamp: Date.now() },
          key2: { data: { title: 'The Office' }, timestamp: Date.now() },
        },
      };

      chrome.storage.sync.get.mockResolvedValue({ cacheDurationHours: 24 });
      chrome.storage.local.get.mockResolvedValue(cacheData);

      await manager.init();
      const stats = await manager.getStats();

      expect(stats.totalItems).toBe(2);
      expect(stats.persistentItems).toBe(2);
      expect(stats.cacheDurationHours).toBe(24);
      expect(stats.sizeEstimateBytes).toBeGreaterThan(0);
      expect(stats.sizeEstimateKb).toBeGreaterThanOrEqual(0);
    });

    test('should handle stats calculation with empty cache', async () => {
      const manager = new CacheManager();
      chrome.storage.sync.get.mockResolvedValue({ cacheDurationHours: 24 });
      chrome.storage.local.get.mockResolvedValue({ netflix_ratings_cache: {} });

      await manager.init();
      const stats = await manager.getStats();

      expect(stats.totalItems).toBe(0);
      expect(stats.persistentItems).toBe(0);
      expect(stats.cacheDurationHours).toBe(24);
    });
  });

  describe('Cache Cleanup', () => {
    test('should remove expired entries from cache', async () => {
      const manager = new CacheManager();
      const now = Date.now();
      const oldTimestamp = now - 48 * 60 * 60 * 1000; // 48 hours ago
      const newTimestamp = now - 1 * 60 * 60 * 1000; // 1 hour ago

      const cacheData = {
        netflix_ratings_cache: {
          expired_key: { data: { title: 'Old Show' }, timestamp: oldTimestamp },
          valid_key: { data: { title: 'Recent Show' }, timestamp: newTimestamp },
        },
      };

      chrome.storage.sync.get.mockResolvedValue({ cacheDurationHours: 24 });
      chrome.storage.local.get.mockResolvedValue(cacheData);
      chrome.storage.local.set.mockResolvedValue(undefined);

      await manager.init();
      const removed = await manager.cleanupExpired();

      expect(removed).toBe(1);
    });

    test('should limit cache size to 500 items', async () => {
      const manager = new CacheManager();
      chrome.storage.sync.get.mockResolvedValue({});
      chrome.storage.local.get.mockResolvedValue({});
      chrome.storage.local.set.mockResolvedValue(undefined);

      await manager.init();

      // Create a large cache to trigger cleanup
      let largeCache = {};
      for (let i = 0; i < 501; i++) {
        largeCache[`key_${i}`] = {
          data: { title: `Show ${i}` },
          timestamp: Date.now() - i * 1000, // older timestamps for higher indices
        };
      }

      chrome.storage.local.get.mockResolvedValue({
        netflix_ratings_cache: largeCache,
      });

      await manager.set(`key_new`, { title: 'New Show' });

      // Verify that cleanup was called and cache is limited
      const lastSetCall = chrome.storage.local.set.mock.calls[chrome.storage.local.set.mock.calls.length - 1];
      const savedCache = lastSetCall[0].netflix_ratings_cache;
      expect(Object.keys(savedCache).length).toBeLessThanOrEqual(501);
    });
  });

  describe('Detailed Cache Info', () => {
    test('should return detailed cache information', async () => {
      const manager = new CacheManager();
      const now = Date.now();
      const onehourAgo = now - 1 * 60 * 60 * 1000;

      const cacheData = {
        netflix_ratings_cache: {
          key1: { data: { title: 'Breaking Bad' }, timestamp: onehourAgo },
        },
      };

      chrome.storage.sync.get.mockResolvedValue({ cacheDurationHours: 24 });
      chrome.storage.local.get.mockResolvedValue(cacheData);

      await manager.init();
      const info = await manager.getDetailedInfo();

      expect(Array.isArray(info)).toBe(true);
      expect(info.length).toBe(1);
      expect(info[0].key).toBe('key1');
      expect(info[0].isExpired).toBe(false);
      expect(info[0].ageMs).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle chrome.storage errors gracefully in get()', async () => {
      const manager = new CacheManager();
      chrome.storage.sync.get.mockResolvedValue({});
      chrome.storage.local.get.mockRejectedValue(new Error('Storage error'));

      await manager.init();
      const result = await manager.get('test_key');

      expect(result).toBeNull();
    });

    test('should handle chrome.storage errors gracefully in set()', async () => {
      const manager = new CacheManager();
      chrome.storage.sync.get.mockResolvedValue({});
      chrome.storage.local.get.mockResolvedValue({});
      chrome.storage.local.set.mockRejectedValue(new Error('Storage error'));

      await manager.init();
      await manager.set('test_key', { title: 'Test' });

      // Should still be in memory cache
      expect(manager.memoryCache.has('test_key')).toBe(true);
    });

    test('should handle chrome.storage errors gracefully in clear()', async () => {
      const manager = new CacheManager();
      chrome.storage.sync.get.mockResolvedValue({});
      chrome.storage.local.set.mockRejectedValue(new Error('Storage error'));

      await manager.init();
      await manager.clear(); // Should not throw

      expect(manager.memoryCache.size).toBe(0);
    });

    test('should handle chrome.storage errors gracefully in getStats()', async () => {
      const manager = new CacheManager();
      chrome.storage.sync.get.mockResolvedValue({});
      chrome.storage.local.get.mockRejectedValue(new Error('Storage error'));

      await manager.init();
      const stats = await manager.getStats();

      expect(stats.totalItems).toBe(0);
      expect(stats.cacheDurationHours).toBe(24);
    });
  });

  describe('Synchronous Cache Operations (getSync, isStaleSync)', () => {
    test('getSync should return null if key not in memory cache', () => {
      const manager = new CacheManager();
      const result = manager.getSync('nonexistent');
      expect(result).toBeNull();
    });

    test('getSync should return cached data if available and not expired', () => {
      const manager = new CacheManager();
      const testData = { imdb: '8.5', metacritic: '78' };

      // Directly set in memory cache
      manager.memoryCache.set('test_key', {
        data: testData,
        timestamp: Date.now(),
      });

      const result = manager.getSync('test_key');
      expect(result).toEqual(testData);
    });

    test('getSync should return null if cached entry is expired', () => {
      const manager = new CacheManager();
      const testData = { imdb: '8.5' };
      const oldTimestamp = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago

      manager.memoryCache.set('expired_key', {
        data: testData,
        timestamp: oldTimestamp,
      });

      const result = manager.getSync('expired_key');
      expect(result).toBeNull();
      expect(manager.memoryCache.has('expired_key')).toBe(false); // Should be deleted
    });

    test('isStaleSync should return true for missing entries', () => {
      const manager = new CacheManager();
      const result = manager.isStaleSync('nonexistent');
      expect(result).toBe(true);
    });

    test('isStaleSync should return false for fresh entries (less than 1 hour old)', () => {
      const manager = new CacheManager();
      const testData = { imdb: '8.5' };
      const recentTimestamp = Date.now() - (30 * 60 * 1000); // 30 minutes ago

      manager.memoryCache.set('fresh_key', {
        data: testData,
        timestamp: recentTimestamp,
      });

      const result = manager.isStaleSync('fresh_key');
      expect(result).toBe(false);
    });

    test('isStaleSync should return true for stale entries (older than 1 hour)', () => {
      const manager = new CacheManager();
      const testData = { imdb: '8.5' };
      const staleTimestamp = Date.now() - (90 * 60 * 1000); // 90 minutes ago

      manager.memoryCache.set('stale_key', {
        data: testData,
        timestamp: staleTimestamp,
      });

      const result = manager.isStaleSync('stale_key');
      expect(result).toBe(true);
    });

    test('getSync should handle errors gracefully', () => {
      const manager = new CacheManager();
      // Simulate corrupted cache entry
      manager.memoryCache.set('corrupt_key', null);

      const result = manager.getSync('corrupt_key');
      expect(result).toBeNull(); // Should not throw, return null
    });
  });

  describe('Auto-initialization', () => {
    test('should auto-initialize if not initialized before get()', async () => {
      const manager = new CacheManager();
      chrome.storage.sync.get.mockResolvedValue({});
      chrome.storage.local.get.mockResolvedValue({});

      expect(manager.initialized).toBe(false);
      await manager.get('test_key');
      expect(manager.initialized).toBe(true);
    });

    test('should auto-initialize if not initialized before set()', async () => {
      const manager = new CacheManager();
      chrome.storage.sync.get.mockResolvedValue({});
      chrome.storage.local.get.mockResolvedValue({});
      chrome.storage.local.set.mockResolvedValue(undefined);

      expect(manager.initialized).toBe(false);
      await manager.set('test_key', { title: 'Test' });
      expect(manager.initialized).toBe(true);
    });
  });
});
