/**
 * Unit Tests for OMDB Service
 *
 * Tests all functionality of the OmdbService class including:
 * - API calls (search, getById, getByTitle)
 * - Caching mechanism
 * - Error handling
 * - Retry logic
 * - Rating extraction
 */

const OmdbService = require('../../src/services/omdb-service');

// Mock fetch globally
global.fetch = jest.fn();

describe('OmdbService', () => {
  let omdbService;
  const TEST_API_KEY = 'test_api_key_12345';

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    omdbService = new OmdbService(TEST_API_KEY);
    // Mock console methods to reduce test output noise
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    // Restore console methods
    console.log.mockRestore();
    console.error.mockRestore();
    console.warn.mockRestore();
  });

  // ==========================================================================
  // Constructor Tests
  // ==========================================================================

  describe('Constructor', () => {
    test('should initialize with API key', () => {
      const service = new OmdbService('my_api_key');
      expect(service.apiKey).toBe('my_api_key');
      expect(service.cache).toBeInstanceOf(Map);
    });

    test('should log initialization', () => {
      console.log.mockRestore();
      const logSpy = jest.spyOn(console, 'log').mockImplementation();
      new OmdbService('test_key');
      expect(logSpy).toHaveBeenCalledWith(
        '[OmdbService] Service initialized with API key:',
        '✓ Present'
      );
    });
  });

  // ==========================================================================
  // Search Method Tests
  // ==========================================================================

  describe('search()', () => {
    const mockSearchResponse = {
      Response: 'True',
      Search: [
        {
          Title: 'The Shawshank Redemption',
          Year: '1994',
          imdbID: 'tt0111161',
          Type: 'movie',
        },
        {
          Title: 'The Shawshank Redemption: Behind the Scenes',
          Year: '2001',
          imdbID: 'tt0293927',
          Type: 'movie',
        },
      ],
      totalResults: '2',
    };

    test('should search for movies by title', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSearchResponse,
      });

      const result = await omdbService.search('Shawshank');

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.totalResults).toBe(2);
      expect(result.results[0].Title).toBe('The Shawshank Redemption');
    });

    test('should include year filter when provided', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSearchResponse,
      });

      await omdbService.search('Shawshank', { year: '1994' });

      const fetchUrl = fetch.mock.calls[0][0];
      expect(fetchUrl).toContain('y=1994');
    });

    test('should include type filter when provided', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSearchResponse,
      });

      await omdbService.search('Shawshank', { type: 'movie' });

      const fetchUrl = fetch.mock.calls[0][0];
      expect(fetchUrl).toContain('type=movie');
    });

    test('should include page parameter when provided', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSearchResponse,
      });

      await omdbService.search('Batman', { page: 2 });

      const fetchUrl = fetch.mock.calls[0][0];
      expect(fetchUrl).toContain('page=2');
    });

    test('should handle empty search results', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          Response: 'False',
          Error: 'Movie not found!',
        }),
      });

      const result = await omdbService.search('NonexistentMovie123456');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Movie not found!');
      expect(result.results).toEqual([]);
    });

    test('should throw error for empty title', async () => {
      await expect(omdbService.search('')).rejects.toThrow('Title is required for search');
      await expect(omdbService.search('   ')).rejects.toThrow('Title is required for search');
    });

    test('should trim title before searching', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSearchResponse,
      });

      await omdbService.search('  Shawshank  ');

      const fetchUrl = fetch.mock.calls[0][0];
      expect(fetchUrl).toContain('s=Shawshank');
      expect(fetchUrl).not.toContain('s=%20%20Shawshank');
    });
  });

  // ==========================================================================
  // getById Method Tests
  // ==========================================================================

  describe('getById()', () => {
    const mockMovieResponse = {
      Response: 'True',
      Title: 'The Shawshank Redemption',
      Year: '1994',
      imdbID: 'tt0111161',
      Type: 'movie',
      imdbRating: '9.3',
      imdbVotes: '2,500,000',
      Metascore: '82',
      Ratings: [
        { Source: 'Internet Movie Database', Value: '9.3/10' },
        { Source: 'Rotten Tomatoes', Value: '89%' },
        { Source: 'Metacritic', Value: '82/100' },
      ],
    };

    test('should fetch movie by IMDb ID', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockMovieResponse,
      });

      const result = await omdbService.getById('tt0111161');

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(result.Title).toBe('The Shawshank Redemption');
      expect(result.imdbRating).toBe('9.3');
    });

    test('should use cache on subsequent calls', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockMovieResponse,
      });

      // First call - should fetch
      const result1 = await omdbService.getById('tt0111161');
      expect(fetch).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const result2 = await omdbService.getById('tt0111161');
      expect(fetch).toHaveBeenCalledTimes(1); // Still only 1 call
      expect(result2).toEqual(result1);
    });

    test('should include plot parameter', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockMovieResponse,
      });

      await omdbService.getById('tt0111161', { plot: 'full' });

      const fetchUrl = fetch.mock.calls[0][0];
      expect(fetchUrl).toContain('plot=full');
    });

    test('should throw error for invalid IMDb ID format', async () => {
      await expect(omdbService.getById('invalid_id')).rejects.toThrow(
        'Invalid IMDb ID format. Must start with "tt"'
      );
      await expect(omdbService.getById('12345')).rejects.toThrow(
        'Invalid IMDb ID format. Must start with "tt"'
      );
    });

    test('should throw error when movie not found', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          Response: 'False',
          Error: 'Incorrect IMDb ID.',
        }),
      });

      await expect(omdbService.getById('tt9999999')).rejects.toThrow(
        'OMDB API Error: Incorrect IMDb ID.'
      );
    });
  });

  // ==========================================================================
  // getByTitle Method Tests
  // ==========================================================================

  describe('getByTitle()', () => {
    const mockMovieResponse = {
      Response: 'True',
      Title: 'Inception',
      Year: '2010',
      imdbID: 'tt1375666',
      Type: 'movie',
      imdbRating: '8.8',
      imdbVotes: '2,200,000',
      Metascore: '74',
      Ratings: [
        { Source: 'Internet Movie Database', Value: '8.8/10' },
        { Source: 'Rotten Tomatoes', Value: '87%' },
      ],
    };

    test('should fetch movie by title', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockMovieResponse,
      });

      const result = await omdbService.getByTitle('Inception');

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(result.Title).toBe('Inception');
      expect(result.imdbRating).toBe('8.8');
    });

    test('should use cache on subsequent calls', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockMovieResponse,
      });

      // First call - should fetch
      await omdbService.getByTitle('Inception');
      expect(fetch).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      await omdbService.getByTitle('Inception');
      expect(fetch).toHaveBeenCalledTimes(1); // Still only 1 call
    });

    test('should include year and type filters', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockMovieResponse,
      });

      await omdbService.getByTitle('Inception', { year: '2010', type: 'movie' });

      const fetchUrl = fetch.mock.calls[0][0];
      expect(fetchUrl).toContain('y=2010');
      expect(fetchUrl).toContain('type=movie');
    });

    test('should throw error for empty title', async () => {
      await expect(omdbService.getByTitle('')).rejects.toThrow('Title is required');
      await expect(omdbService.getByTitle('  ')).rejects.toThrow('Title is required');
    });
  });

  // ==========================================================================
  // Rating Extraction Tests
  // ==========================================================================

  describe('extractRatings()', () => {
    test('should extract all three ratings', () => {
      const omdbData = {
        Title: 'Test Movie',
        imdbRating: '8.5',
        imdbVotes: '500,000',
        Metascore: '75',
        Ratings: [
          { Source: 'Internet Movie Database', Value: '8.5/10' },
          { Source: 'Rotten Tomatoes', Value: '85%' },
          { Source: 'Metacritic', Value: '75/100' },
        ],
      };

      const ratings = omdbService.extractRatings(omdbData);

      expect(ratings.imdb).toEqual({
        value: '8.5',
        votes: '500,000',
        outOf: '10',
      });
      expect(ratings.metacritic).toEqual({
        value: '75',
        outOf: '100',
      });
      expect(ratings.rottenTomatoes).toEqual({
        value: '85%',
        source: 'Rotten Tomatoes',
      });
    });

    test('should handle missing IMDb rating', () => {
      const omdbData = {
        Title: 'Test Movie',
        imdbRating: 'N/A',
        Metascore: '75',
        Ratings: [{ Source: 'Rotten Tomatoes', Value: '85%' }],
      };

      const ratings = omdbService.extractRatings(omdbData);

      expect(ratings.imdb).toBeNull();
      expect(ratings.metacritic.value).toBe('75');
      expect(ratings.rottenTomatoes.value).toBe('85%');
    });

    test('should handle missing Metacritic score', () => {
      const omdbData = {
        Title: 'Test Movie',
        imdbRating: '8.5',
        imdbVotes: '500,000',
        Metascore: 'N/A',
        Ratings: [{ Source: 'Rotten Tomatoes', Value: '85%' }],
      };

      const ratings = omdbService.extractRatings(omdbData);

      expect(ratings.imdb.value).toBe('8.5');
      expect(ratings.metacritic).toBeNull();
      expect(ratings.rottenTomatoes.value).toBe('85%');
    });

    test('should handle missing Rotten Tomatoes rating', () => {
      const omdbData = {
        Title: 'Test Movie',
        imdbRating: '8.5',
        imdbVotes: '500,000',
        Metascore: '75',
        Ratings: [{ Source: 'Internet Movie Database', Value: '8.5/10' }],
      };

      const ratings = omdbService.extractRatings(omdbData);

      expect(ratings.imdb.value).toBe('8.5');
      expect(ratings.metacritic.value).toBe('75');
      expect(ratings.rottenTomatoes).toBeNull();
    });

    test('should handle completely missing ratings', () => {
      const omdbData = {
        Title: 'Test Movie',
        imdbRating: 'N/A',
        Metascore: 'N/A',
        Ratings: [],
      };

      const ratings = omdbService.extractRatings(omdbData);

      expect(ratings.imdb).toBeNull();
      expect(ratings.metacritic).toBeNull();
      expect(ratings.rottenTomatoes).toBeNull();
    });

    test('should handle invalid input', () => {
      expect(omdbService.extractRatings(null)).toEqual({
        imdb: null,
        metacritic: null,
        rottenTomatoes: null,
      });

      expect(omdbService.extractRatings(undefined)).toEqual({
        imdb: null,
        metacritic: null,
        rottenTomatoes: null,
      });

      expect(omdbService.extractRatings('invalid')).toEqual({
        imdb: null,
        metacritic: null,
        rottenTomatoes: null,
      });
    });
  });

  // ==========================================================================
  // Rating Formatting Tests
  // ==========================================================================

  describe('formatRatings()', () => {
    test('should format all three ratings', () => {
      const ratings = {
        imdb: { value: '8.5', votes: '500,000', outOf: '10' },
        metacritic: { value: '75', outOf: '100' },
        rottenTomatoes: { value: '85%', source: 'Rotten Tomatoes' },
      };

      const formatted = omdbService.formatRatings(ratings);

      expect(formatted).toBe('IMDb: 8.5/10 | MC: 75/100 | RT: 85%');
    });

    test('should handle missing ratings gracefully', () => {
      const ratings = {
        imdb: { value: '8.5', votes: '500,000', outOf: '10' },
        metacritic: null,
        rottenTomatoes: null,
      };

      const formatted = omdbService.formatRatings(ratings);

      expect(formatted).toBe('IMDb: 8.5/10');
    });

    test('should return message when no ratings available', () => {
      const ratings = {
        imdb: null,
        metacritic: null,
        rottenTomatoes: null,
      };

      const formatted = omdbService.formatRatings(ratings);

      expect(formatted).toBe('No ratings available');
    });
  });

  // ==========================================================================
  // Cache Management Tests
  // ==========================================================================

  describe('Cache Management', () => {
    test('clearCache() should remove all entries', async () => {
      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ Response: 'True', Title: 'Test' }),
      });

      // Add some items to cache
      await omdbService.getById('tt0111161');
      await omdbService.getByTitle('Inception');

      expect(omdbService.cache.size).toBeGreaterThan(0);

      omdbService.clearCache();

      expect(omdbService.cache.size).toBe(0);
    });

    test('getCacheStats() should return cache information', async () => {
      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ Response: 'True', Title: 'Test' }),
      });

      await omdbService.getById('tt0111161');

      const stats = omdbService.getCacheStats();

      expect(stats.size).toBeGreaterThan(0);
      expect(Array.isArray(stats.entries)).toBe(true);
    });
  });

  // ==========================================================================
  // Retry Logic Tests
  // ==========================================================================

  describe('Retry Logic', () => {
    test('should retry on network failure', async () => {
      fetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ Response: 'True', Title: 'Success' }),
        });

      const result = await omdbService.getById('tt0111161');

      expect(fetch).toHaveBeenCalledTimes(3);
      expect(result.Title).toBe('Success');
    });

    test('should throw error after max retries', async () => {
      fetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'));

      await expect(omdbService.getById('tt0111161')).rejects.toThrow(
        'Failed to fetch after 3 attempts'
      );

      expect(fetch).toHaveBeenCalledTimes(3);
    });

    test('should retry on HTTP errors', async () => {
      fetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ Response: 'True', Title: 'Success' }),
        });

      const result = await omdbService.getById('tt0111161');

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(result.Title).toBe('Success');
    });
  });
});
