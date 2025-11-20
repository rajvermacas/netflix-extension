/**
 * Integration tests for cache persistence
 * Tests that cache data survives across service worker restarts
 */

// Mock chrome.storage APIs
const mockStorage = {
  sync: {},
  local: {},
};

global.chrome = {
  storage: {
    sync: {
      get: jest.fn((keys, callback) => {
        setTimeout(() => {
          const result = {};
          if (Array.isArray(keys)) {
            keys.forEach(key => {
              if (mockStorage.sync[key]) {
                result[key] = mockStorage.sync[key];
              }
            });
          }
          callback(result);
        }, 0);
      }),
      set: jest.fn((obj, callback) => {
        setTimeout(() => {
          Object.assign(mockStorage.sync, obj);
          if (callback) callback();
        }, 0);
      }),
    },
    local: {
      get: jest.fn(async (keys, callback) => {
        const result = {};
        if (Array.isArray(keys)) {
          keys.forEach(key => {
            if (mockStorage.local[key]) {
              result[key] = mockStorage.local[key];
            }
          });
        } else if (typeof keys === 'string') {
          if (mockStorage.local[keys]) {
            result[keys] = mockStorage.local[keys];
          }
        }
        if (callback) {
          callback(result);
        } else {
          return Promise.resolve(result);
        }
      }),
      set: jest.fn((obj, callback) => {
        Object.assign(mockStorage.local, obj);
        if (callback) callback();
        return Promise.resolve();
      }),
    },
  },
};

const CacheManager = require('../../src/utils/cache-manager');

describe('Cache Persistence Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage.sync = {};
    mockStorage.local = {};
  });

  test('should persist cache data across instances', async () => {
    const testKey = 'test_movie_breaking_bad';
    const testData = {
      imdb: { value: '9.5', votes: '2000000' },
      metacritic: { value: '96' },
      rottenTomatoes: { value: '99%' },
    };

    // Create first instance and set data
    const manager1 = new CacheManager();
    await manager1.init();
    await manager1.set(testKey, testData);

    // Verify data was saved to persistent storage
    expect(mockStorage.local.netflix_ratings_cache).toBeDefined();
    expect(mockStorage.local.netflix_ratings_cache[testKey]).toBeDefined();

    // Create second instance (simulating service worker restart)
    const manager2 = new CacheManager();
    await manager2.init();

    // Retrieve data from new instance
    const retrievedData = await manager2.get(testKey);

    // Verify data persists
    expect(retrievedData).toEqual(testData);
  });

  test('should respect cache duration across instances', async () => {
    const testKey = 'test_movie_withexpiration';
    const testData = { imdb: { value: '8.0' } };
    const now = Date.now();

    // Create old cache entry (48 hours old)
    const oldTimestamp = now - 48 * 60 * 60 * 1000;
    mockStorage.local.netflix_ratings_cache = {
      [testKey]: {
        data: testData,
        timestamp: oldTimestamp,
      },
    };

    // Set cache duration to 24 hours
    mockStorage.sync.cacheDurationHours = 24;

    // Create new instance
    const manager = new CacheManager();
    await manager.init();

    // Try to retrieve expired data
    const retrievedData = await manager.get(testKey);

    // Should return null because data is expired
    expect(retrievedData).toBeNull();
  });

  test('should initialize with default cache duration if not set', async () => {
    const manager = new CacheManager();
    await manager.init();

    const duration = await manager.getCacheDuration();
    expect(duration).toBe(24); // Default to 24 hours
  });

  test('should persist custom cache duration setting', async () => {
    // Set custom duration in first instance
    const manager1 = new CacheManager();
    await manager1.init();
    await manager1.setCacheDuration(72); // 72 hours

    // Verify it was saved
    expect(mockStorage.sync.cacheDurationHours).toBe(72);

    // Create second instance
    const manager2 = new CacheManager();
    await manager2.init();

    // Verify duration is retrieved
    const duration = await manager2.getCacheDuration();
    expect(duration).toBe(72);
  });

  test('should handle cache size limit on persistent storage', async () => {
    const manager = new CacheManager();
    await manager.init();

    // Create large cache to trigger cleanup
    let largeCache = {};
    for (let i = 0; i < 502; i++) {
      largeCache[`key_${i}`] = {
        data: { title: `Show ${i}` },
        timestamp: Date.now() - i * 1000,
      };
    }

    mockStorage.local.netflix_ratings_cache = largeCache;

    // Add one more item (should trigger cleanup)
    await manager.set('key_final', { title: 'Final Show' });

    // Verify cache was cleaned up
    const cacheSize = Object.keys(mockStorage.local.netflix_ratings_cache).length;
    expect(cacheSize).toBeLessThanOrEqual(501);
  });

  test('should properly handle concurrent operations', async () => {
    const manager = new CacheManager();
    await manager.init();

    const operations = [
      manager.set('key1', { data: 'value1' }),
      manager.set('key2', { data: 'value2' }),
      manager.set('key3', { data: 'value3' }),
      manager.get('key1'),
      manager.get('key2'),
      manager.getStats(),
    ];

    const results = await Promise.all(operations);

    // Verify all operations completed
    expect(results).toHaveLength(6);
    expect(results[3]).toEqual({ data: 'value1' }); // get('key1')
    expect(results[4]).toEqual({ data: 'value2' }); // get('key2')
    expect(results[5].totalItems).toBe(3); // stats
  });

  test('should survive fallback to memory cache if persistent storage fails', async () => {
    // Simulate storage failure
    chrome.storage.local.get.mockImplementation(() => {
      throw new Error('Storage unavailable');
    });

    const manager = new CacheManager();
    await manager.init();

    // Memory cache should still work
    await manager.set('fallback_key', { data: 'fallback_value' });
    const retrieved = await manager.get('fallback_key');

    expect(retrieved).toEqual({ data: 'fallback_value' });
  });

  test('should cleanup expired entries on retrieval', async () => {
    const manager = new CacheManager();
    const now = Date.now();

    // Create mix of valid and expired entries
    mockStorage.local.netflix_ratings_cache = {
      valid_key: {
        data: { title: 'Fresh' },
        timestamp: now - 1 * 60 * 60 * 1000, // 1 hour old
      },
      expired_key: {
        data: { title: 'Stale' },
        timestamp: now - 48 * 60 * 60 * 1000, // 48 hours old
      },
    };

    mockStorage.sync.cacheDurationHours = 24;

    await manager.init();

    // Get valid entry
    const valid = await manager.get('valid_key');
    expect(valid).toEqual({ title: 'Fresh' });

    // Try expired entry
    const expired = await manager.get('expired_key');
    expect(expired).toBeNull();

    // Verify expired entry was removed
    expect(mockStorage.local.netflix_ratings_cache.expired_key).toBeUndefined();
  });

  test('should provide accurate stats from persistent storage', async () => {
    const manager = new CacheManager();

    // Setup persistent cache with known data
    mockStorage.local.netflix_ratings_cache = {
      key1: { data: { title: 'Show1' }, timestamp: Date.now() },
      key2: { data: { title: 'Show2' }, timestamp: Date.now() },
      key3: { data: { title: 'Show3' }, timestamp: Date.now() },
    };
    mockStorage.sync.cacheDurationHours = 24;

    await manager.init();
    const stats = await manager.getStats();

    expect(stats.totalItems).toBe(3);
    expect(stats.persistentItems).toBe(3);
    expect(stats.cacheDurationHours).toBe(24);
    expect(stats.sizeEstimateBytes).toBeGreaterThan(0);
  });
});
