# OMDB API Implementation Examples

Production-ready code examples for integrating OMDB API into your Netflix extension.

---

## Table of Contents

1. [JavaScript/Node.js Examples](#javascriptnodejs-examples)
2. [Python Examples](#python-examples)
3. [Comparison & Selection Guide](#comparison--selection-guide)
4. [Testing & Validation](#testing--validation)

---

## JavaScript/Node.js Examples

### Complete Movie Service Module

```javascript
// omdb-service.js
class OmdbService {
  constructor(apiKey = process.env.OMDB_API_KEY) {
    if (!apiKey) {
      throw new Error("OMDB_API_KEY is required");
    }
    this.apiKey = apiKey;
    this.baseUrl = "http://www.omdbapi.com";
    this.cache = new Map();
    this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Build and validate URL parameters
   * @private
   */
  _buildUrl(params) {
    const allParams = {
      apikey: this.apiKey,
      r: "json",
      ...params
    };

    // Validate at least one search parameter exists
    if (!allParams.i && !allParams.t && !allParams.s) {
      throw new Error("Must provide either 'i' (IMDb ID), 't' (title), or 's' (search)");
    }

    const query = new URLSearchParams(allParams).toString();
    return `${this.baseUrl}/?${query}`;
  }

  /**
   * Get cache key from parameters
   * @private
   */
  _getCacheKey(params) {
    return JSON.stringify(params);
  }

  /**
   * Check if cache entry is valid
   * @private
   */
  _isCacheValid(entry) {
    return entry && (Date.now() - entry.timestamp < this.cacheExpiry);
  }

  /**
   * Make HTTP request with error handling
   * @private
   */
  async _fetch(url) {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.Response === "False") {
        throw new Error(data.Error || "Unknown API error");
      }

      return data;
    } catch (error) {
      throw new Error(`OMDB API Error: ${error.message}`);
    }
  }

  /**
   * Search for movies/series
   * @param {string} query - Search query
   * @param {Object} options - Additional search options
   * @param {string} [options.type] - Filter by type: 'movie', 'series', 'episode'
   * @param {number} [options.year] - Filter by year
   * @param {number} [options.page] - Results page (1-100, default: 1)
   * @returns {Promise<Object>} - Search results with Search array and totalResults
   */
  async search(query, options = {}) {
    const params = {
      s: query,
      ...options.type && { type: options.type },
      ...options.year && { y: options.year },
      ...options.page && { page: options.page }
    };

    const cacheKey = this._getCacheKey(params);
    const cached = this.cache.get(cacheKey);

    if (this._isCacheValid(cached)) {
      return cached.data;
    }

    const url = this._buildUrl(params);
    const data = await this._fetch(url);

    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });

    return data;
  }

  /**
   * Get movie/series details by IMDb ID
   * @param {string} imdbId - IMDb ID (e.g., 'tt0111161')
   * @param {Object} options - Additional options
   * @param {string} [options.plot] - 'short' (default) or 'full'
   * @returns {Promise<Object>} - Complete movie/series details
   */
  async getById(imdbId, options = {}) {
    const params = {
      i: imdbId,
      ...options.plot && { plot: options.plot }
    };

    const cacheKey = this._getCacheKey(params);
    const cached = this.cache.get(cacheKey);

    if (this._isCacheValid(cached)) {
      return cached.data;
    }

    const url = this._buildUrl(params);
    const data = await this._fetch(url);

    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });

    return data;
  }

  /**
   * Get movie/series details by title
   * @param {string} title - Movie or series title
   * @param {Object} options - Additional options
   * @param {string} [options.type] - Filter by type: 'movie', 'series'
   * @param {number} [options.year] - Release year
   * @param {string} [options.plot] - 'short' (default) or 'full'
   * @returns {Promise<Object>} - Complete movie/series details
   */
  async getByTitle(title, options = {}) {
    const params = {
      t: title,
      ...options.type && { type: options.type },
      ...options.year && { y: options.year },
      ...options.plot && { plot: options.plot }
    };

    const cacheKey = this._getCacheKey(params);
    const cached = this.cache.get(cacheKey);

    if (this._isCacheValid(cached)) {
      return cached.data;
    }

    const url = this._buildUrl(params);
    const data = await this._fetch(url);

    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });

    return data;
  }

  /**
   * Get TV series episode details
   * @param {string} seriesTitleOrId - Series title or IMDb ID
   * @param {number} season - Season number
   * @param {number} episode - Episode number
   * @param {Object} options - Additional options
   * @param {string} [options.plot] - 'short' (default) or 'full'
   * @returns {Promise<Object>} - Episode details
   */
  async getEpisode(seriesTitleOrId, season, episode, options = {}) {
    const params = {
      ...(seriesTitleOrId.startsWith('tt') ? { i: seriesTitleOrId } : { t: seriesTitleOrId }),
      Season: season,
      Episode: episode,
      ...options.plot && { plot: options.plot }
    };

    const cacheKey = this._getCacheKey(params);
    const cached = this.cache.get(cacheKey);

    if (this._isCacheValid(cached)) {
      return cached.data;
    }

    const url = this._buildUrl(params);
    const data = await this._fetch(url);

    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });

    return data;
  }

  /**
   * Extract ratings from movie/series data
   * @param {Object} data - Movie/series data from API
   * @returns {Object} - Parsed ratings object
   */
  extractRatings(data) {
    const ratings = {
      imdb: null,
      metacritic: null,
      rottenTomatoes: null
    };

    // IMDb Rating
    if (data.imdbRating && data.imdbRating !== "N/A") {
      ratings.imdb = {
        score: parseFloat(data.imdbRating),
        votes: parseInt(data.imdbVotes?.replace(/,/g, '') || 0),
        maxScore: 10
      };
    }

    // Metacritic Score
    if (data.Metascore && data.Metascore !== "N/A") {
      ratings.metacritic = {
        score: parseInt(data.Metascore),
        maxScore: 100
      };
    }

    // Rotten Tomatoes Score
    if (Array.isArray(data.Ratings)) {
      const rtRating = data.Ratings.find(r => r.Source === "Rotten Tomatoes");
      if (rtRating && rtRating.Value !== "N/A") {
        const scoreStr = rtRating.Value.replace('%', '');
        ratings.rottenTomatoes = {
          score: parseInt(scoreStr),
          maxScore: 100
        };
      }
    }

    return ratings;
  }

  /**
   * Format ratings for display
   * @param {Object} ratings - Ratings object from extractRatings()
   * @returns {string} - Formatted ratings string
   */
  formatRatings(ratings) {
    const parts = [];

    if (ratings.imdb) {
      parts.push(`IMDb: ${ratings.imdb.score}/${ratings.imdb.maxScore}`);
    }

    if (ratings.metacritic) {
      parts.push(`MC: ${ratings.metacritic.score}/${ratings.metacritic.maxScore}`);
    }

    if (ratings.rottenTomatoes) {
      parts.push(`RT: ${ratings.rottenTomatoes.score}%`);
    }

    return parts.length > 0 ? parts.join(" | ") : "No ratings available";
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   * @returns {Object} - Cache stats
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }
}

module.exports = OmdbService;
```

### Usage Examples

```javascript
// usage-example.js
const OmdbService = require('./omdb-service');

async function main() {
  const omdb = new OmdbService('b9bd48a6');

  try {
    // Example 1: Search for movies
    console.log("\n=== Search Example ===");
    const searchResults = await omdb.search('Inception', {
      type: 'movie'
    });
    console.log(`Found ${searchResults.totalResults} results`);
    searchResults.Search.slice(0, 3).forEach(movie => {
      console.log(`- ${movie.Title} (${movie.Year})`);
    });

    // Example 2: Get movie by ID
    console.log("\n=== Get by ID Example ===");
    const movie = await omdb.getById('tt1375666', { plot: 'full' });
    console.log(`Title: ${movie.Title}`);
    console.log(`Plot: ${movie.Plot}`);
    console.log(`Director: ${movie.Director}`);

    // Example 3: Extract and display ratings
    console.log("\n=== Ratings Example ===");
    const ratings = omdb.extractRatings(movie);
    console.log(omdb.formatRatings(ratings));

    // Example 4: Get TV episode
    console.log("\n=== Episode Example ===");
    const episode = await omdb.getEpisode('Game of Thrones', 1, 1);
    console.log(`Episode: ${episode.Title} S${episode.Season}E${episode.Episode}`);
    console.log(`Rating: ${episode.imdbRating}/10`);

    // Example 5: Get series details
    console.log("\n=== Series Example ===");
    const series = await omdb.getByTitle('Breaking Bad', { type: 'series' });
    console.log(`Series: ${series.Title}`);
    console.log(`Seasons: ${series.totalSeasons}`);
    const seriesRatings = omdb.extractRatings(series);
    console.log(omdb.formatRatings(seriesRatings));

    // Example 6: Cache statistics
    console.log("\n=== Cache Stats ===");
    console.log(omdb.getCacheStats());

  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
}

main();
```

### Integration with Express.js

```javascript
// routes/movies.js
const express = require('express');
const OmdbService = require('../services/omdb-service');

const router = express.Router();
const omdb = new OmdbService();

/**
 * GET /api/movies/search?q=title&type=movie&year=2023
 */
router.get('/search', async (req, res) => {
  try {
    const { q, type, year, page } = req.query;

    if (!q) {
      return res.status(400).json({ error: "Query parameter 'q' is required" });
    }

    const results = await omdb.search(q, {
      type: type || undefined,
      year: year ? parseInt(year) : undefined,
      page: page ? parseInt(page) : 1
    });

    res.json({
      success: true,
      total: parseInt(results.totalResults),
      page: parseInt(results.page || 1),
      results: results.Search
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/movies/:id - Get full movie details
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { plot } = req.query;

    const movie = await omdb.getById(id, {
      plot: plot === 'full' ? 'full' : 'short'
    });

    const ratings = omdb.extractRatings(movie);

    res.json({
      success: true,
      data: {
        ...movie,
        ratings,
        ratings_formatted: omdb.formatRatings(ratings)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/series/:title/season/:season/episode/:episode
 */
router.get('/series/:title/season/:season/episode/:episode', async (req, res) => {
  try {
    const { title, season, episode } = req.params;

    const episodeData = await omdb.getEpisode(
      title,
      parseInt(season),
      parseInt(episode),
      { plot: 'full' }
    );

    res.json({
      success: true,
      data: episodeData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
```

---

## Python Examples

### Complete Movie Service Module

```python
# omdb_service.py
import os
import requests
import json
from typing import Optional, Dict, List
from datetime import datetime, timedelta
from urllib.parse import urlencode
import logging

logger = logging.getLogger(__name__)


class OmdbService:
    """Service for interacting with OMDB API"""

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize OMDB Service

        Args:
            api_key: OMDB API key. Defaults to OMDB_API_KEY env var
        """
        self.api_key = api_key or os.getenv('OMDB_API_KEY')
        if not self.api_key:
            raise ValueError("OMDB_API_KEY is required")

        self.base_url = "http://www.omdbapi.com"
        self.cache = {}
        self.cache_expiry = 24 * 60 * 60  # 24 hours in seconds
        self.session = requests.Session()

    def _build_url(self, params: Dict) -> str:
        """Build API URL with parameters"""
        # Validate required parameters
        if not any(params.get(p) for p in ['i', 't', 's']):
            raise ValueError(
                "Must provide either 'i' (IMDb ID), 't' (title), or 's' (search)"
            )

        all_params = {
            'apikey': self.api_key,
            'r': 'json',
            **params
        }

        query_string = urlencode(all_params)
        return f"{self.base_url}/?{query_string}"

    def _get_cache_key(self, params: Dict) -> str:
        """Generate cache key from parameters"""
        return json.dumps(params, sort_keys=True)

    def _is_cache_valid(self, entry: Dict) -> bool:
        """Check if cache entry is still valid"""
        if not entry:
            return False
        return (datetime.now() - entry['timestamp']).total_seconds() < self.cache_expiry

    def _fetch(self, url: str) -> Dict:
        """Fetch data from API with error handling"""
        try:
            response = self.session.get(url, timeout=10)
            response.raise_for_status()

            data = response.json()

            if data.get('Response') == 'False':
                raise ValueError(data.get('Error', 'Unknown API error'))

            return data

        except requests.exceptions.RequestException as e:
            logger.error(f"Request failed: {e}")
            raise

    def search(
        self,
        query: str,
        media_type: Optional[str] = None,
        year: Optional[int] = None,
        page: int = 1
    ) -> Dict:
        """
        Search for movies/series

        Args:
            query: Search query string
            media_type: Filter by type ('movie', 'series', 'episode')
            year: Filter by year
            page: Results page (1-100)

        Returns:
            Dict with Search array and totalResults count
        """
        params = {
            's': query,
            'page': page
        }

        if media_type:
            params['type'] = media_type
        if year:
            params['y'] = year

        cache_key = self._get_cache_key(params)
        cached = self.cache.get(cache_key)

        if self._is_cache_valid(cached):
            return cached['data']

        url = self._build_url(params)
        data = self._fetch(url)

        self.cache[cache_key] = {
            'data': data,
            'timestamp': datetime.now()
        }

        return data

    def get_by_id(
        self,
        imdb_id: str,
        plot: str = 'short'
    ) -> Dict:
        """
        Get movie/series details by IMDb ID

        Args:
            imdb_id: IMDb ID (e.g., 'tt0111161')
            plot: 'short' or 'full'

        Returns:
            Complete movie/series details
        """
        params = {
            'i': imdb_id,
            'plot': plot
        }

        cache_key = self._get_cache_key(params)
        cached = self.cache.get(cache_key)

        if self._is_cache_valid(cached):
            return cached['data']

        url = self._build_url(params)
        data = self._fetch(url)

        self.cache[cache_key] = {
            'data': data,
            'timestamp': datetime.now()
        }

        return data

    def get_by_title(
        self,
        title: str,
        media_type: Optional[str] = None,
        year: Optional[int] = None,
        plot: str = 'short'
    ) -> Dict:
        """
        Get movie/series details by title

        Args:
            title: Movie or series title
            media_type: Filter by type ('movie', 'series')
            year: Release year
            plot: 'short' or 'full'

        Returns:
            Complete movie/series details
        """
        params = {
            't': title,
            'plot': plot
        }

        if media_type:
            params['type'] = media_type
        if year:
            params['y'] = year

        cache_key = self._get_cache_key(params)
        cached = self.cache.get(cache_key)

        if self._is_cache_valid(cached):
            return cached['data']

        url = self._build_url(params)
        data = self._fetch(url)

        self.cache[cache_key] = {
            'data': data,
            'timestamp': datetime.now()
        }

        return data

    def get_episode(
        self,
        series_title_or_id: str,
        season: int,
        episode: int,
        plot: str = 'short'
    ) -> Dict:
        """
        Get TV series episode details

        Args:
            series_title_or_id: Series title or IMDb ID
            season: Season number
            episode: Episode number
            plot: 'short' or 'full'

        Returns:
            Episode details
        """
        params = {
            'Season': season,
            'Episode': episode,
            'plot': plot
        }

        if series_title_or_id.startswith('tt'):
            params['i'] = series_title_or_id
        else:
            params['t'] = series_title_or_id

        cache_key = self._get_cache_key(params)
        cached = self.cache.get(cache_key)

        if self._is_cache_valid(cached):
            return cached['data']

        url = self._build_url(params)
        data = self._fetch(url)

        self.cache[cache_key] = {
            'data': data,
            'timestamp': datetime.now()
        }

        return data

    def extract_ratings(self, data: Dict) -> Dict:
        """
        Extract ratings from movie/series data

        Args:
            data: Movie/series data from API

        Returns:
            Dict with parsed ratings
        """
        ratings = {
            'imdb': None,
            'metacritic': None,
            'rotten_tomatoes': None
        }

        # IMDb Rating
        if data.get('imdbRating') and data['imdbRating'] != 'N/A':
            try:
                votes_str = data.get('imdbVotes', '0').replace(',', '')
                ratings['imdb'] = {
                    'score': float(data['imdbRating']),
                    'votes': int(votes_str),
                    'max_score': 10
                }
            except (ValueError, AttributeError):
                pass

        # Metacritic Score
        if data.get('Metascore') and data['Metascore'] != 'N/A':
            try:
                ratings['metacritic'] = {
                    'score': int(data['Metascore']),
                    'max_score': 100
                }
            except ValueError:
                pass

        # Rotten Tomatoes Score
        if data.get('Ratings'):
            for rating in data['Ratings']:
                if rating.get('Source') == 'Rotten Tomatoes':
                    try:
                        score_str = rating['Value'].replace('%', '')
                        ratings['rotten_tomatoes'] = {
                            'score': int(score_str),
                            'max_score': 100
                        }
                    except (ValueError, KeyError):
                        pass
                    break

        return ratings

    def format_ratings(self, ratings: Dict) -> str:
        """
        Format ratings for display

        Args:
            ratings: Ratings dict from extract_ratings()

        Returns:
            Formatted ratings string
        """
        parts = []

        if ratings['imdb']:
            r = ratings['imdb']
            parts.append(f"IMDb: {r['score']}/{r['max_score']}")

        if ratings['metacritic']:
            r = ratings['metacritic']
            parts.append(f"MC: {r['score']}/{r['max_score']}")

        if ratings['rotten_tomatoes']:
            r = ratings['rotten_tomatoes']
            parts.append(f"RT: {r['score']}%")

        return " | ".join(parts) if parts else "No ratings available"

    def clear_cache(self):
        """Clear cache"""
        self.cache.clear()

    def get_cache_stats(self) -> Dict:
        """Get cache statistics"""
        return {
            'size': len(self.cache),
            'entries': list(self.cache.keys())
        }
```

### Usage Examples

```python
# usage_example.py
from omdb_service import OmdbService

def main():
    omdb = OmdbService('b9bd48a6')

    try:
        # Example 1: Search for movies
        print("\n=== Search Example ===")
        results = omdb.search('Inception', media_type='movie')
        print(f"Found {results['totalResults']} results")
        for movie in results['Search'][:3]:
            print(f"- {movie['Title']} ({movie['Year']})")

        # Example 2: Get movie by ID
        print("\n=== Get by ID Example ===")
        movie = omdb.get_by_id('tt1375666', plot='full')
        print(f"Title: {movie['Title']}")
        print(f"Plot: {movie['Plot']}")
        print(f"Director: {movie['Director']}")

        # Example 3: Extract and display ratings
        print("\n=== Ratings Example ===")
        ratings = omdb.extract_ratings(movie)
        print(omdb.format_ratings(ratings))

        # Example 4: Get TV episode
        print("\n=== Episode Example ===")
        episode = omdb.get_episode('Game of Thrones', 1, 1)
        print(f"Episode: {episode['Title']} S{episode['Season']}E{episode['Episode']}")
        print(f"Rating: {episode['imdbRating']}/10")

        # Example 5: Get series details
        print("\n=== Series Example ===")
        series = omdb.get_by_title('Breaking Bad', media_type='series')
        print(f"Series: {series['Title']}")
        print(f"Seasons: {series['totalSeasons']}")
        ratings = omdb.extract_ratings(series)
        print(omdb.format_ratings(ratings))

        # Example 6: Cache statistics
        print("\n=== Cache Stats ===")
        print(omdb.get_cache_stats())

    except Exception as error:
        print(f"Error: {error}")


if __name__ == '__main__':
    main()
```

### Integration with Flask

```python
# routes/movies.py
from flask import Blueprint, request, jsonify
from omdb_service import OmdbService

movies_bp = Blueprint('movies', __name__, url_prefix='/api/movies')
omdb = OmdbService()


@movies_bp.route('/search', methods=['GET'])
def search():
    """Search for movies/series"""
    try:
        q = request.args.get('q')
        if not q:
            return jsonify({'error': "Query parameter 'q' is required"}), 400

        media_type = request.args.get('type')
        year = request.args.get('year', type=int)
        page = request.args.get('page', default=1, type=int)

        results = omdb.search(q, media_type=media_type, year=year, page=page)

        return jsonify({
            'success': True,
            'total': int(results['totalResults']),
            'page': page,
            'results': results['Search']
        })

    except Exception as error:
        return jsonify({'success': False, 'error': str(error)}), 500


@movies_bp.route('/<imdb_id>', methods=['GET'])
def get_movie(imdb_id):
    """Get movie details by IMDb ID"""
    try:
        plot = request.args.get('plot', default='short')
        movie = omdb.get_by_id(imdb_id, plot=plot)
        ratings = omdb.extract_ratings(movie)

        return jsonify({
            'success': True,
            'data': {
                **movie,
                'ratings': ratings,
                'ratings_formatted': omdb.format_ratings(ratings)
            }
        })

    except Exception as error:
        return jsonify({'success': False, 'error': str(error)}), 500


@movies_bp.route('/series/<title>/season/<int:season>/episode/<int:episode>', methods=['GET'])
def get_episode(title, season, episode):
    """Get TV episode details"""
    try:
        episode_data = omdb.get_episode(title, season, episode, plot='full')

        return jsonify({
            'success': True,
            'data': episode_data
        })

    except Exception as error:
        return jsonify({'success': False, 'error': str(error)}), 500
```

---

## Comparison & Selection Guide

### Language Comparison

| Feature | JavaScript | Python |
|---|---|---|
| **Async** | Native Promises/async-await | asyncio / requests |
| **Caching** | Map or Object | Dict or external cache |
| **Dependencies** | Node built-in fetch (v18+) or npm | requests library |
| **Best For** | Chrome extension, Web app | Backend, Data processing |
| **Performance** | Good in browsers | Better for batch processing |

### Use Cases

**Choose JavaScript if:**
- Building Netflix Chrome extension
- Running in browser environment
- Need real-time UI updates
- Integrating with web frameworks (Express, Next.js)

**Choose Python if:**
- Building backend service
- Processing bulk data
- Need complex data manipulation
- Integrating with data analysis tools (pandas, etc.)

---

## Testing & Validation

### JavaScript Unit Tests

```javascript
// omdb-service.test.js
const OmdbService = require('../omdb-service');

describe('OmdbService', () => {
  let omdb;

  beforeEach(() => {
    omdb = new OmdbService('b9bd48a6');
  });

  describe('search', () => {
    it('should return search results', async () => {
      const results = await omdb.search('Inception');
      expect(results.Response).toBe('True');
      expect(Array.isArray(results.Search)).toBe(true);
    });

    it('should filter by type', async () => {
      const results = await omdb.search('Breaking Bad', { type: 'series' });
      const allSeries = results.Search.every(r => r.Type === 'series');
      expect(allSeries).toBe(true);
    });
  });

  describe('getById', () => {
    it('should return movie details', async () => {
      const movie = await omdb.getById('tt1375666');
      expect(movie.Title).toBe('Inception');
      expect(movie.Type).toBe('movie');
    });
  });

  describe('extractRatings', () => {
    it('should extract all available ratings', async () => {
      const movie = await omdb.getById('tt0111161');
      const ratings = omdb.extractRatings(movie);

      expect(ratings.imdb).not.toBeNull();
      expect(ratings.imdb.score).toBeGreaterThan(0);
    });
  });
});
```

### Python Unit Tests

```python
# test_omdb_service.py
import unittest
from omdb_service import OmdbService


class TestOmdbService(unittest.TestCase):

    def setUp(self):
        self.omdb = OmdbService('b9bd48a6')

    def test_search(self):
        results = self.omdb.search('Inception')
        self.assertEqual(results['Response'], 'True')
        self.assertIn('Search', results)
        self.assertTrue(len(results['Search']) > 0)

    def test_search_by_type(self):
        results = self.omdb.search('Breaking Bad', media_type='series')
        self.assertTrue(all(r['Type'] == 'series' for r in results['Search']))

    def test_get_by_id(self):
        movie = self.omdb.get_by_id('tt1375666')
        self.assertEqual(movie['Title'], 'Inception')
        self.assertEqual(movie['Type'], 'movie')

    def test_extract_ratings(self):
        movie = self.omdb.get_by_id('tt0111161')
        ratings = self.omdb.extract_ratings(movie)
        self.assertIsNotNone(ratings['imdb'])
        self.assertGreater(ratings['imdb']['score'], 0)

    def test_cache(self):
        # First call
        movie1 = self.omdb.get_by_id('tt1375666')
        cache_size_1 = len(self.omdb.cache)

        # Second call (should hit cache)
        movie2 = self.omdb.get_by_id('tt1375666')
        cache_size_2 = len(self.omdb.cache)

        self.assertEqual(cache_size_1, cache_size_2)
        self.assertEqual(movie1, movie2)


if __name__ == '__main__':
    unittest.main()
```

