/**
 * OMDB API Service
 *
 * Provides interface to fetch movie/series ratings from OMDB API.
 * Includes caching, error handling, and comprehensive logging.
 *
 * @module OmdbService
 */

const OMDB_API_BASE_URL = 'https://www.omdbapi.com/';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

/**
 * OMDB API Service Class
 * Handles all interactions with the OMDB API including caching and retries
 */
class OmdbService {
  /**
   * @param {string} apiKey - OMDB API key
   */
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.cache = new Map();
    console.log('[OmdbService] Service initialized with API key:', apiKey ? '✓ Present' : '✗ Missing');
  }

  /**
   * Search for movies/series by title
   *
   * @param {string} title - Movie or series title
   * @param {Object} options - Search options
   * @param {string} options.year - Release year (optional)
   * @param {string} options.type - 'movie' or 'series' (optional)
   * @param {number} options.page - Page number for pagination (optional)
   * @returns {Promise<Object>} Search results
   */
  async search(title, options = {}) {
    console.log('[OmdbService] Searching for:', title, 'Options:', options);

    if (!title || title.trim().length === 0) {
      console.error('[OmdbService] Search failed: Empty title provided');
      throw new Error('Title is required for search');
    }

    const params = new URLSearchParams({
      apikey: this.apiKey,
      s: title.trim(),
    });

    if (options.year) {
      params.append('y', options.year);
      console.log('[OmdbService] Adding year filter:', options.year);
    }

    if (options.type) {
      params.append('type', options.type);
      console.log('[OmdbService] Adding type filter:', options.type);
    }

    if (options.page) {
      params.append('page', options.page);
      console.log('[OmdbService] Adding page filter:', options.page);
    }

    const url = `${OMDB_API_BASE_URL}?${params.toString()}`;
    console.log('[OmdbService] Search URL constructed:', url.replace(this.apiKey, 'API_KEY_HIDDEN'));

    try {
      const response = await this._fetchWithRetry(url);
      console.log('[OmdbService] Search successful. Results found:', response.totalResults || 0);

      if (response.Response === 'False') {
        console.warn('[OmdbService] Search returned no results:', response.Error);
        return { success: false, error: response.Error, results: [] };
      }

      return {
        success: true,
        results: response.Search || [],
        totalResults: parseInt(response.totalResults) || 0,
      };
    } catch (error) {
      console.error('[OmdbService] Search failed with error:', error.message);
      throw error;
    }
  }

  /**
   * Get movie/series details by IMDb ID
   *
   * @param {string} imdbId - IMDb ID (e.g., 'tt0111161')
   * @param {Object} options - Fetch options
   * @param {string} options.plot - 'short' or 'full' (default: 'short')
   * @returns {Promise<Object>} Movie/series details with ratings
   */
  async getById(imdbId, options = {}) {
    console.log('[OmdbService] Fetching by IMDb ID:', imdbId, 'Options:', options);

    if (!imdbId || !imdbId.startsWith('tt')) {
      console.error('[OmdbService] Invalid IMDb ID format:', imdbId);
      throw new Error('Invalid IMDb ID format. Must start with "tt"');
    }

    // Check cache first
    const cacheKey = `id:${imdbId}:${options.plot || 'short'}`;
    const cached = this._getFromCache(cacheKey);
    if (cached) {
      console.log('[OmdbService] Cache hit for IMDb ID:', imdbId);
      return cached;
    }

    const params = new URLSearchParams({
      apikey: this.apiKey,
      i: imdbId,
      plot: options.plot || 'short',
    });

    const url = `${OMDB_API_BASE_URL}?${params.toString()}`;
    console.log('[OmdbService] Fetch URL constructed:', url.replace(this.apiKey, 'API_KEY_HIDDEN'));

    try {
      const response = await this._fetchWithRetry(url);

      if (response.Response === 'False') {
        console.warn('[OmdbService] Fetch by ID failed:', response.Error);
        throw new Error(`OMDB API Error: ${response.Error}`);
      }

      console.log('[OmdbService] Successfully fetched data for:', response.Title, `(${response.Year})`);

      // Cache the result
      this._setCache(cacheKey, response);

      return response;
    } catch (error) {
      console.error('[OmdbService] Fetch by ID failed with error:', error.message);
      throw error;
    }
  }

  /**
   * Get movie/series details by title
   *
   * @param {string} title - Movie or series title
   * @param {Object} options - Fetch options
   * @param {string} options.year - Release year (optional)
   * @param {string} options.type - 'movie' or 'series' (optional)
   * @param {string} options.plot - 'short' or 'full' (default: 'short')
   * @returns {Promise<Object>} Movie/series details with ratings
   */
  async getByTitle(title, options = {}) {
    console.log('[OmdbService] Fetching by title:', title, 'Options:', options);

    if (!title || title.trim().length === 0) {
      console.error('[OmdbService] Fetch failed: Empty title provided');
      throw new Error('Title is required');
    }

    // Check cache first
    const cacheKey = `title:${title}:${options.year || ''}:${options.type || ''}:${options.plot || 'short'}`;
    const cached = this._getFromCache(cacheKey);
    if (cached) {
      console.log('[OmdbService] Cache hit for title:', title);
      return cached;
    }

    const params = new URLSearchParams({
      apikey: this.apiKey,
      t: title.trim(),
      plot: options.plot || 'short',
    });

    if (options.year) {
      params.append('y', options.year);
      console.log('[OmdbService] Adding year filter:', options.year);
    }

    if (options.type) {
      params.append('type', options.type);
      console.log('[OmdbService] Adding type filter:', options.type);
    }

    const url = `${OMDB_API_BASE_URL}?${params.toString()}`;
    console.log('[OmdbService] Fetch URL constructed:', url.replace(this.apiKey, 'API_KEY_HIDDEN'));

    try {
      const response = await this._fetchWithRetry(url);

      if (response.Response === 'False') {
        console.warn('[OmdbService] Fetch by title failed:', response.Error);
        throw new Error(`OMDB API Error: ${response.Error}`);
      }

      console.log('[OmdbService] Successfully fetched data for:', response.Title, `(${response.Year})`);

      // Cache the result
      this._setCache(cacheKey, response);

      return response;
    } catch (error) {
      console.error('[OmdbService] Fetch by title failed with error:', error.message);
      throw error;
    }
  }

  /**
   * Extract ratings from OMDB API response
   *
   * @param {Object} omdbData - OMDB API response object
   * @returns {Object} Extracted ratings { imdb, metacritic, rottenTomatoes }
   */
  extractRatings(omdbData) {
    console.log('[OmdbService] Extracting ratings from OMDB data for:', omdbData?.Title || 'Unknown');

    if (!omdbData || typeof omdbData !== 'object') {
      console.error('[OmdbService] Invalid OMDB data provided for rating extraction');
      return { imdb: null, metacritic: null, rottenTomatoes: null };
    }

    const ratings = {
      imdb: null,
      metacritic: null,
      rottenTomatoes: null,
    };

    // Extract IMDb rating (direct field)
    if (omdbData.imdbRating && omdbData.imdbRating !== 'N/A') {
      ratings.imdb = {
        value: omdbData.imdbRating,
        votes: omdbData.imdbVotes || 'N/A',
        outOf: '10',
      };
      console.log('[OmdbService] IMDb rating extracted:', ratings.imdb.value);
    } else {
      console.log('[OmdbService] IMDb rating not available');
    }

    // Extract Metacritic score (direct field)
    if (omdbData.Metascore && omdbData.Metascore !== 'N/A') {
      ratings.metacritic = {
        value: omdbData.Metascore,
        outOf: '100',
      };
      console.log('[OmdbService] Metacritic score extracted:', ratings.metacritic.value);
    } else {
      console.log('[OmdbService] Metacritic score not available');
    }

    // Extract Rotten Tomatoes rating (from Ratings array)
    if (omdbData.Ratings && Array.isArray(omdbData.Ratings)) {
      const rtRating = omdbData.Ratings.find(
        r => r.Source === 'Rotten Tomatoes'
      );

      if (rtRating && rtRating.Value) {
        ratings.rottenTomatoes = {
          value: rtRating.Value,
          source: rtRating.Source,
        };
        console.log('[OmdbService] Rotten Tomatoes rating extracted:', ratings.rottenTomatoes.value);
      } else {
        console.log('[OmdbService] Rotten Tomatoes rating not found in Ratings array');
      }
    } else {
      console.log('[OmdbService] No Ratings array available');
    }

    console.log('[OmdbService] Rating extraction complete. Available ratings:',
      Object.keys(ratings).filter(k => ratings[k] !== null).join(', ') || 'None');

    return ratings;
  }

  /**
   * Format ratings for display
   *
   * @param {Object} ratings - Ratings object from extractRatings()
   * @returns {string} Formatted rating string
   */
  formatRatings(ratings) {
    console.log('[OmdbService] Formatting ratings for display');

    const parts = [];

    if (ratings.imdb) {
      parts.push(`IMDb: ${ratings.imdb.value}/10`);
    }

    if (ratings.metacritic) {
      parts.push(`MC: ${ratings.metacritic.value}/100`);
    }

    if (ratings.rottenTomatoes) {
      parts.push(`RT: ${ratings.rottenTomatoes.value}`);
    }

    const formatted = parts.length > 0 ? parts.join(' | ') : 'No ratings available';
    console.log('[OmdbService] Formatted rating string:', formatted);

    return formatted;
  }

  /**
   * Clear all cached data
   */
  clearCache() {
    const size = this.cache.size;
    this.cache.clear();
    console.log(`[OmdbService] Cache cleared. Removed ${size} entries.`);
  }

  /**
   * Get cache statistics
   *
   * @returns {Object} Cache stats { size, entries }
   */
  getCacheStats() {
    const stats = {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
    };
    console.log('[OmdbService] Cache stats:', stats);
    return stats;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Fetch with exponential backoff retry logic
   *
   * @private
   * @param {string} url - URL to fetch
   * @param {number} attempt - Current attempt number
   * @returns {Promise<Object>} Parsed JSON response
   */
  async _fetchWithRetry(url, attempt = 1) {
    console.log(`[OmdbService] Fetch attempt ${attempt}/${MAX_RETRY_ATTEMPTS}`);

    try {
      const response = await fetch(url);

      console.log('[OmdbService] HTTP Response status:', response.status, response.statusText);

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[OmdbService] Response parsed successfully');

      return data;
    } catch (error) {
      console.error(`[OmdbService] Fetch attempt ${attempt} failed:`, error.message);

      if (attempt < MAX_RETRY_ATTEMPTS) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1); // Exponential backoff
        console.log(`[OmdbService] Retrying in ${delay}ms...`);

        await this._sleep(delay);
        return this._fetchWithRetry(url, attempt + 1);
      }

      console.error('[OmdbService] All retry attempts exhausted');
      throw new Error(`Failed to fetch after ${MAX_RETRY_ATTEMPTS} attempts: ${error.message}`);
    }
  }

  /**
   * Get item from cache if not expired
   *
   * @private
   * @param {string} key - Cache key
   * @returns {Object|null} Cached data or null
   */
  _getFromCache(key) {
    const cached = this.cache.get(key);

    if (!cached) {
      console.log('[OmdbService] Cache miss for key:', key);
      return null;
    }

    const now = Date.now();
    const age = now - cached.timestamp;

    if (age > CACHE_DURATION_MS) {
      console.log('[OmdbService] Cache entry expired for key:', key, `Age: ${Math.round(age / 1000 / 60)} minutes`);
      this.cache.delete(key);
      return null;
    }

    console.log('[OmdbService] Cache hit for key:', key, `Age: ${Math.round(age / 1000 / 60)} minutes`);
    return cached.data;
  }

  /**
   * Set item in cache with timestamp
   *
   * @private
   * @param {string} key - Cache key
   * @param {Object} data - Data to cache
   */
  _setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
    console.log('[OmdbService] Data cached with key:', key, `Total cache size: ${this.cache.size}`);
  }

  /**
   * Sleep utility for retry delays
   *
   * @private
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export for use in Chrome extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OmdbService;
}
