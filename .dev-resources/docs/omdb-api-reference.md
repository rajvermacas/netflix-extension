# OMDB API Reference Documentation

**Last Updated:** November 19, 2025
**API Version:** Current
**Official Website:** http://www.omdbapi.com/
**Documentation Date:** 2025-11-19

---

## Table of Contents

1. [Overview](#overview)
2. [Installation & Setup](#installation--setup)
3. [API Base URL & Authentication](#api-base-url--authentication)
4. [Request Endpoints](#request-endpoints)
5. [Request Parameters](#request-parameters)
6. [Response Format](#response-format)
7. [Searching & Filtering](#searching--filtering)
8. [Response Fields](#response-fields)
9. [Ratings Extraction Guide](#ratings-extraction-guide)
10. [Code Examples](#code-examples)
11. [Error Handling](#error-handling)
12. [Rate Limits & Best Practices](#rate-limits--best-practices)
13. [Complete Example Responses](#complete-example-responses)

---

## Overview

The OMDB (Open Movie Database) API is a RESTful web service that provides comprehensive movie and TV series information, including plot summaries, ratings from multiple sources, cast information, awards, and more.

### Key Features

- Search for movies and TV series by title
- Retrieve detailed information by IMDb ID
- Support for TV series episodes with Season and Episode parameters
- Multiple rating sources: IMDb, Rotten Tomatoes, Metacritic
- Pagination support for search results (up to 100 pages)
- Response format options: JSON and XML
- Full plot summaries available on request

### Official Documentation Links

- Main Site: http://www.omdbapi.com/
- OpenAPI/Swagger: http://www.omdbapi.com/swagger.yaml (or .json)
- GitHub Issues: https://github.com/omdbapi/OMDb-API/issues

---

## Installation & Setup

### Getting an API Key

The OMDB API now offers free keys. Visit http://www.omdbapi.com/apikey.aspx to request one.

**Important Notes:**
- Free API keys are available and functional
- Keys are distributed via email (from the registration form)
- Older keys obtained through other methods may eventually expire
- HTTPS support is available: https://www.omdbapi.com/

### Configuration

No installation required. Simply include the API key in your request parameters.

**Example API Key:** `b9bd48a6` (provided for testing)

#### Environment Variable Setup (Recommended)

```bash
# Add to your .env file
OMDB_API_KEY=your_api_key_here

# Or set as environment variable
export OMDB_API_KEY=your_api_key_here
```

#### Using in Different Languages

**Node.js/JavaScript:**
```javascript
const apiKey = process.env.OMDB_API_KEY;
```

**Python:**
```python
import os
api_key = os.getenv('OMDB_API_KEY')
```

---

## API Base URL & Authentication

### Base URL

```
http://www.omdbapi.com/
https://www.omdbapi.com/  (HTTPS with TLS available)
```

### Poster Images URL

```
http://img.omdbapi.com/
```

### Authentication Method

The OMDB API uses **API Key in Query Parameters** for authentication.

**Format:**
```
http://www.omdbapi.com/?apikey=YOUR_API_KEY&other_params
```

### All Requests Require

- `apikey` parameter with your valid API key
- At least one content parameter:
  - `i` (IMDb ID), OR
  - `t` (Title), OR
  - `s` (Search term)

---

## Request Endpoints

The OMDB API uses a single endpoint with different parameters to control behavior.

### Endpoint Structure

```
GET http://www.omdbapi.com/?apikey=[key]&[search_type]&[additional_params]
```

### Search Types

| Endpoint Type | Parameter | Purpose |
|---|---|---|
| **Exact Match (ID)** | `i=tt1234567` | Retrieve by IMDb ID (most reliable) |
| **Exact Match (Title)** | `t=Movie Title` | Retrieve by exact title match |
| **Search** | `s=Query` | Search for multiple matches (paginated) |

### Distinction Between Search and Exact Match

- **Exact Match (`i` or `t`)**: Returns single result with full details
- **Search (`s`)**: Returns paginated list with basic info (title, year, IMDb ID, poster, type)

---

## Request Parameters

### Parameters for Exact Retrieval (by ID or Title)

| Parameter | Required | Valid Values | Default | Description |
|---|---|---|---|---|
| `apikey` | Yes | String | - | Your API key |
| `i` | Optional* | IMDb ID (e.g., tt1285016) | Empty | Valid IMDb ID |
| `t` | Optional* | Movie/Series title | Empty | Movie or series title to search for |
| `type` | No | `movie`, `series`, `episode` | Empty | Type of result to return (filters results) |
| `y` | No | Year (e.g., 1994) | Empty | Year of release (helps disambiguate titles) |
| `Season` | No | Integer (1-N) | - | Season number for TV series |
| `Episode` | No | Integer (1-N) | - | Episode number within season |
| `plot` | No | `short`, `full` | `short` | Length of plot summary |
| `r` | No | `json`, `xml` | `json` | Response format |
| `callback` | No | JSONP callback name | Empty | For JSONP requests |
| `v` | No | Version number | 1 | API version (reserved for future use) |

**\* Note:** At least one of `i` or `t` is required for exact retrieval

### Parameters for Search (by Title)

| Parameter | Required | Valid Values | Default | Description |
|---|---|---|---|---|
| `apikey` | Yes | String | - | Your API key |
| `s` | Yes | Search query string | - | Movie/series title to search for |
| `type` | No | `movie`, `series`, `episode` | Empty | Type of result to return |
| `y` | No | Year (e.g., 1994) | Empty | Year to filter results |
| `page` | No | 1-100 | 1 | Page number of results (10 results per page) |
| `r` | No | `json`, `xml` | `json` | Response format |
| `callback` | No | JSONP callback name | Empty | For JSONP requests |
| `v` | No | Version number | 1 | API version (reserved for future use) |

### Parameter Encoding Notes

- Spaces in titles must be URL-encoded: use `%20` or `+`
- Special characters should be properly URL-encoded
- Example: "The Shawshank Redemption" → `The%20Shawshank%20Redemption`

---

## Response Format

### HTTP Status Codes

- **200 OK**: Successful request
- **401 Unauthorized**: Invalid API key
- **400 Bad Request**: Missing required parameters

### Response Wrapper

All responses include a `Response` field indicating success/failure:

```json
{
  "Response": "True",
  "...": "actual_data"
}
```

OR

```json
{
  "Response": "False",
  "Error": "Error message describing the issue"
}
```

### Content-Type

- `application/json` for JSON responses
- `application/xml` for XML responses

---

## Searching & Filtering

### Search by Title with Pagination

**Request:**
```
http://www.omdbapi.com/?apikey=b9bd48a6&s=Batman&page=1
```

**Returns:**
- List of matches (up to 10 per page)
- Total number of matches in `totalResults`
- Pagination: 1-100 pages available
- Each result includes: Title, Year, imdbID, Type, Poster

### Search with Type Filter

**Request:**
```
http://www.omdbapi.com/?apikey=b9bd48a6&s=Breaking&type=series
```

**Effect:**
- Filters results to only return series
- Valid types: `movie`, `series`, `episode`

### Search with Year Filter

**Request:**
```
http://www.omdbapi.com/?apikey=b9bd48a6&s=Batman&y=2005
```

**Effect:**
- Filters to results from specified year
- More accurate when combined with type filter

### Exact Title Match

**Request:**
```
http://www.omdbapi.com/?apikey=b9bd48a6&t=The%20Shawshank%20Redemption&y=1994&type=movie
```

**Effect:**
- Returns exact match (single result) with full details
- Year filter helps disambiguate if multiple titles exist
- Type filter narrows down results

### Retrieval by IMDb ID

**Request:**
```
http://www.omdbapi.com/?apikey=b9bd48a6&i=tt0111161
```

**Effect:**
- Most reliable method - returns exact single result
- No ambiguity regardless of title
- Returns full detailed information

### TV Series Episodes

**Request (Full Series Details):**
```
http://www.omdbapi.com/?apikey=b9bd48a6&t=Game%20of%20Thrones&Season=1
```

**Request (Specific Episode):**
```
http://www.omdbapi.com/?apikey=b9bd48a6&t=Game%20of%20Thrones&Season=1&Episode=1
```

**Or by Series ID:**
```
http://www.omdbapi.com/?apikey=b9bd48a6&i=tt0944947&Season=1&Episode=1
```

---

## Response Fields

### Movie/Series Response Fields

| Field | Type | Present? | Description |
|---|---|---|---|
| `Title` | String | Always | Title of the movie or series |
| `Year` | String | Always | Release year or year range (e.g., "1994" or "2008–2013") |
| `Rated` | String | Sometimes | MPAA rating (G, PG, PG-13, R, etc.) or TV rating (TV-MA, etc.) |
| `Released` | String | Sometimes | Full release date (e.g., "14 Oct 1994") |
| `Runtime` | String | Sometimes | Duration in minutes (e.g., "142 min") |
| `Genre` | String | Always | Comma-separated genres |
| `Director` | String | Sometimes | Director name(s) (N/A if not applicable) |
| `Writer` | String | Sometimes | Writer/Creator name(s) |
| `Actors` | String | Always | Comma-separated cast members (main actors) |
| `Plot` | String | Sometimes | Plot summary (short by default, full if requested) |
| `Language` | String | Always | Language(s) used in the title |
| `Country` | String | Always | Production country/countries |
| `Awards` | String | Sometimes | Award nominations and wins summary |
| `Poster` | URL String | Sometimes | URL to poster image (N/A if not available) |
| `Ratings` | Array | Always | Array of rating objects from different sources |
| `Metascore` | String | Sometimes | Metacritic score (0-100) or "N/A" |
| `imdbRating` | String | Always | IMDb rating (0.0-10.0) |
| `imdbVotes` | String | Always | Number of IMDb votes (formatted with commas) |
| `imdbID` | String | Always | IMDb identifier (e.g., tt0111161) |
| `Type` | String | Always | "movie", "series", or "episode" |
| `DVD` | String | Sometimes | DVD release date or "N/A" |
| `BoxOffice` | String | Sometimes | Box office earnings or "N/A" |
| `Production` | String | Sometimes | Production company info |
| `Website` | String | Sometimes | Official website URL |
| `Response` | String | Always | "True" or "False" indicating success |

### TV Series-Specific Fields

| Field | Type | Description |
|---|---|---|
| `totalSeasons` | String | Number of seasons in the series |

### TV Episode-Specific Fields

| Field | Type | Description |
|---|---|---|
| `Season` | String | Season number of the episode |
| `Episode` | String | Episode number within the season |
| `seriesID` | String | IMDb ID of the parent series |

### Search Results Fields

When using the `s` (search) parameter, each result includes:

| Field | Type | Description |
|---|---|---|
| `Title` | String | Title of the result |
| `Year` | String | Release year or range |
| `imdbID` | String | IMDb identifier |
| `Type` | String | "movie", "series", or "episode" |
| `Poster` | URL String | URL to poster image or "N/A" |
| `totalResults` | String | Total number of matches for query |
| `Response` | String | "True" or "False" |

---

## Ratings Extraction Guide

The OMDB API provides ratings from three main sources. Here's how to extract each:

### Complete Ratings Structure

```json
{
  "Ratings": [
    {
      "Source": "Internet Movie Database",
      "Value": "9.3/10"
    },
    {
      "Source": "Rotten Tomatoes",
      "Value": "89%"
    },
    {
      "Source": "Metacritic",
      "Value": "82/100"
    }
  ],
  "Metascore": "82",
  "imdbRating": "9.3",
  "imdbVotes": "3,120,594"
}
```

### IMDb Rating

**Source Field:** Multiple locations

```javascript
// Method 1: Direct field (fastest)
const imdbRating = response.imdbRating;  // "9.3"
const imdbVotes = response.imdbVotes;    // "3,120,594"

// Method 2: From Ratings array
const ratingObj = response.Ratings.find(r => r.Source === "Internet Movie Database");
const imdbRating = ratingObj?.Value;  // "9.3/10"
```

**Format:** `X.X/10` (e.g., 9.3, 7.5)
**Range:** 0.0 to 10.0
**Availability:** Always present for movies and series

### Metacritic Score

**Source Field:** Multiple locations

```javascript
// Method 1: Direct field (fastest)
const metacriticScore = response.Metascore;  // "82" or "N/A"

// Method 2: From Ratings array
const ratingObj = response.Ratings.find(r => r.Source === "Metacritic");
const metacriticScore = ratingObj?.Value;  // "82/100" or undefined
```

**Format:** `XX/100` (e.g., 82/100) when available
**Range:** 0 to 100
**Availability:** Not always present (especially for TV series and older content)
**Fallback:** When N/A, the field is omitted from Ratings array

### Rotten Tomatoes Score

**Source Field:** Ratings array only

```javascript
// From Ratings array (only location)
const ratingObj = response.Ratings.find(r => r.Source === "Rotten Tomatoes");
const rtScore = ratingObj?.Value;  // "89%"
```

**Format:** `XX%` (e.g., 89%, 96%)
**Range:** 0% to 100%
**Availability:** Often present for popular titles, but not guaranteed
**Fallback:** Undefined if not available

### Complete Extraction Function

```javascript
function extractRatings(response) {
  const ratings = {
    imdb: {
      rating: response.imdbRating || "N/A",
      votes: response.imdbVotes || "N/A",
      source: "Internet Movie Database"
    },
    metacritic: {
      score: response.Metascore || "N/A",
      source: "Metacritic"
    },
    rottenTomatoes: {
      score: "N/A",
      source: "Rotten Tomatoes"
    }
  };

  // Extract Rotten Tomatoes from Ratings array
  const rtRating = response.Ratings?.find(
    r => r.Source === "Rotten Tomatoes"
  );
  if (rtRating) {
    ratings.rottenTomatoes.score = rtRating.Value;
  }

  return ratings;
}
```

### Handling Missing Ratings

**Important:** Not all ratings are available for all titles:

- **IMDb Rating:** Always present for movies and series
- **Metacritic:** Frequently missing for TV series, older movies, and less popular titles
- **Rotten Tomatoes:** Often present for popular titles, but not guaranteed

**Recommended Approach:**

```javascript
function displayRating(source, value) {
  if (value && value !== "N/A") {
    return `${source}: ${value}`;
  }
  return `${source}: Not rated`;
}
```

---

## Code Examples

### JavaScript/Node.js Examples

#### Example 1: Search for a Movie

```javascript
const fetch = require('node-fetch');

async function searchMovie(title, apiKey) {
  const encodedTitle = encodeURIComponent(title);
  const url = `http://www.omdbapi.com/?apikey=${apiKey}&s=${encodedTitle}&type=movie`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.Response === "True") {
      console.log(`Found ${data.totalResults} results:`);
      data.Search.forEach(result => {
        console.log(`- ${result.Title} (${result.Year}) - IMDb ID: ${result.imdbID}`);
      });
      return data.Search;
    } else {
      console.error(`Error: ${data.Error}`);
      return [];
    }
  } catch (error) {
    console.error(`Network error: ${error.message}`);
    return [];
  }
}

// Usage
searchMovie('Inception', 'b9bd48a6');
```

#### Example 2: Get Movie Details by ID

```javascript
async function getMovieDetails(imdbId, apiKey) {
  const url = `http://www.omdbapi.com/?apikey=${apiKey}&i=${imdbId}&plot=full`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.Response === "True") {
      return {
        title: data.Title,
        year: data.Year,
        plot: data.Plot,
        rating: data.imdbRating,
        votes: data.imdbVotes,
        genres: data.Genre,
        director: data.Director,
        actors: data.Actors,
        poster: data.Poster,
        allRatings: data.Ratings
      };
    } else {
      throw new Error(data.Error);
    }
  } catch (error) {
    console.error(`Failed to fetch movie: ${error.message}`);
    return null;
  }
}

// Usage
getMovieDetails('tt0111161', 'b9bd48a6').then(movie => {
  console.log(movie);
});
```

#### Example 3: Extract All Ratings

```javascript
function parseRatings(response) {
  const result = {
    imdb: null,
    metacritic: null,
    rottenTomatoes: null,
    raw: response.Ratings || []
  };

  // Extract from direct fields
  if (response.imdbRating && response.imdbRating !== "N/A") {
    result.imdb = {
      score: parseFloat(response.imdbRating),
      votes: parseInt(response.imdbVotes.replace(/,/g, ''))
    };
  }

  if (response.Metascore && response.Metascore !== "N/A") {
    result.metacritic = {
      score: parseInt(response.Metascore)
    };
  }

  // Extract from Ratings array
  if (Array.isArray(response.Ratings)) {
    const rtRating = response.Ratings.find(r => r.Source === "Rotten Tomatoes");
    if (rtRating && rtRating.Value !== "N/A") {
      result.rottenTomatoes = {
        score: parseInt(rtRating.Value)
      };
    }
  }

  return result;
}

// Usage
const ratings = parseRatings(movieData);
console.log(`IMDb: ${ratings.imdb?.score}/10`);
console.log(`Metacritic: ${ratings.metacritic?.score}/100`);
console.log(`Rotten Tomatoes: ${ratings.rottenTomatoes?.score}%`);
```

#### Example 4: Search with Pagination

```javascript
async function searchWithPagination(query, apiKey, maxPages = 3) {
  const allResults = [];

  for (let page = 1; page <= maxPages; page++) {
    const encodedQuery = encodeURIComponent(query);
    const url = `http://www.omdbapi.com/?apikey=${apiKey}&s=${encodedQuery}&page=${page}`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.Response === "True" && data.Search) {
        allResults.push(...data.Search);

        // Stop if we've got all results
        if (allResults.length >= parseInt(data.totalResults)) {
          break;
        }
      } else {
        break;
      }
    } catch (error) {
      console.error(`Error fetching page ${page}: ${error.message}`);
      break;
    }
  }

  return allResults;
}

// Usage
searchWithPagination('Batman', 'b9bd48a6', 2).then(results => {
  console.log(`Found ${results.length} results`);
});
```

#### Example 5: Get TV Series Episode Details

```javascript
async function getEpisodeDetails(seriesTitle, season, episode, apiKey) {
  const encodedTitle = encodeURIComponent(seriesTitle);
  const url = `http://www.omdbapi.com/?apikey=${apiKey}&t=${encodedTitle}&Season=${season}&Episode=${episode}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.Response === "True") {
      return {
        title: data.Title,
        episodeTitle: data.Episode,
        seasonNum: data.Season,
        episodeNum: data.Episode,
        plot: data.Plot,
        rating: data.imdbRating,
        releaseDate: data.Released,
        director: data.Director,
        seriesId: data.seriesID
      };
    } else {
      throw new Error(data.Error);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    return null;
  }
}

// Usage
getEpisodeDetails('Game of Thrones', 1, 1, 'b9bd48a6').then(episode => {
  console.log(episode);
});
```

### Python Examples

#### Example 1: Basic Movie Search

```python
import requests
import os
from typing import List, Dict, Optional

API_KEY = os.getenv('OMDB_API_KEY', 'b9bd48a6')
BASE_URL = 'http://www.omdbapi.com/'

def search_movies(title: str, movie_type: str = None) -> Optional[List[Dict]]:
    """Search for movies by title"""
    params = {
        'apikey': API_KEY,
        's': title,
        'type': movie_type or 'movie'
    }

    try:
        response = requests.get(BASE_URL, params=params)
        response.raise_for_status()
        data = response.json()

        if data.get('Response') == 'True':
            return data.get('Search', [])
        else:
            print(f"Error: {data.get('Error')}")
            return []
    except requests.exceptions.RequestException as e:
        print(f"Request failed: {e}")
        return []

# Usage
results = search_movies('Inception')
for movie in results:
    print(f"{movie['Title']} ({movie['Year']})")
```

#### Example 2: Get Complete Movie Details

```python
def get_movie_by_id(imdb_id: str) -> Optional[Dict]:
    """Get complete movie details by IMDb ID"""
    params = {
        'apikey': API_KEY,
        'i': imdb_id,
        'plot': 'full'
    }

    try:
        response = requests.get(BASE_URL, params=params)
        response.raise_for_status()
        data = response.json()

        if data.get('Response') == 'True':
            return data
        else:
            print(f"Error: {data.get('Error')}")
            return None
    except requests.exceptions.RequestException as e:
        print(f"Request failed: {e}")
        return None

# Usage
movie = get_movie_by_id('tt0111161')
if movie:
    print(f"Title: {movie['Title']}")
    print(f"Plot: {movie['Plot']}")
    print(f"IMDb Rating: {movie['imdbRating']}/10")
```

#### Example 3: Extract Ratings

```python
def extract_ratings(movie_data: Dict) -> Dict:
    """Extract ratings from all sources"""
    ratings = {
        'imdb': {
            'score': None,
            'votes': None
        },
        'metacritic': {
            'score': None
        },
        'rotten_tomatoes': {
            'score': None
        }
    }

    # IMDb ratings
    if movie_data.get('imdbRating') != 'N/A':
        ratings['imdb']['score'] = float(movie_data.get('imdbRating', 0))
        votes_str = movie_data.get('imdbVotes', '0').replace(',', '')
        ratings['imdb']['votes'] = int(votes_str)

    # Metacritic
    if movie_data.get('Metascore') != 'N/A':
        ratings['metacritic']['score'] = int(movie_data.get('Metascore', 0))

    # Rotten Tomatoes
    if movie_data.get('Ratings'):
        for rating in movie_data['Ratings']:
            if rating['Source'] == 'Rotten Tomatoes':
                score_str = rating['Value'].replace('%', '')
                ratings['rotten_tomatoes']['score'] = int(score_str)
                break

    return ratings

# Usage
movie = get_movie_by_id('tt0111161')
ratings = extract_ratings(movie)
print(f"IMDb: {ratings['imdb']['score']}/10 ({ratings['imdb']['votes']} votes)")
print(f"Metacritic: {ratings['metacritic']['score']}/100")
print(f"Rotten Tomatoes: {ratings['rotten_tomatoes']['score']}%")
```

#### Example 4: Search with Pagination

```python
def search_all_pages(query: str, max_pages: int = 10) -> List[Dict]:
    """Search and fetch all pages of results"""
    all_results = []

    for page in range(1, max_pages + 1):
        params = {
            'apikey': API_KEY,
            's': query,
            'page': page
        }

        try:
            response = requests.get(BASE_URL, params=params)
            response.raise_for_status()
            data = response.json()

            if data.get('Response') == 'True':
                all_results.extend(data.get('Search', []))

                # Check if we have all results
                total = int(data.get('totalResults', 0))
                if len(all_results) >= total:
                    break
            else:
                break
        except requests.exceptions.RequestException as e:
            print(f"Error on page {page}: {e}")
            break

    return all_results

# Usage
results = search_all_pages('Batman', max_pages=3)
print(f"Found {len(results)} results")
```

#### Example 5: Get TV Episode Details

```python
def get_episode_details(series_title: str, season: int, episode: int) -> Optional[Dict]:
    """Get details for a specific TV episode"""
    params = {
        'apikey': API_KEY,
        't': series_title,
        'Season': season,
        'Episode': episode
    }

    try:
        response = requests.get(BASE_URL, params=params)
        response.raise_for_status()
        data = response.json()

        if data.get('Response') == 'True':
            return {
                'series_title': data.get('Title'),
                'episode_title': data.get('Title'),  # Same title for episode
                'season': int(data.get('Season', 0)),
                'episode': int(data.get('Episode', 0)),
                'plot': data.get('Plot'),
                'rating': float(data.get('imdbRating', 0)),
                'release_date': data.get('Released'),
                'director': data.get('Director'),
                'series_id': data.get('seriesID')
            }
        else:
            print(f"Error: {data.get('Error')}")
            return None
    except requests.exceptions.RequestException as e:
        print(f"Request failed: {e}")
        return None

# Usage
episode = get_episode_details('Game of Thrones', 1, 1)
if episode:
    print(f"Season {episode['season']}, Episode {episode['episode']}")
    print(f"Title: {episode['episode_title']}")
    print(f"Rating: {episode['rating']}/10")
```

---

## Error Handling

### Common Error Responses

#### 1. Invalid API Key

**Response:**
```json
{
  "Response": "False",
  "Error": "Invalid API key!"
}
```

**Causes:**
- API key not provided
- Invalid/expired API key
- API key with typo

**Solution:**
```javascript
if (data.Error.includes("Invalid API key")) {
  console.error("Please provide a valid API key");
  // Refresh or re-register for new key
}
```

#### 2. Movie Not Found

**Response:**
```json
{
  "Response": "False",
  "Error": "Movie not found!"
}
```

**Causes:**
- Movie doesn't exist in OMDB database
- Title misspelled
- Using search parameter (`s`) with exact title

**Solution:**
```javascript
// Try with type filter for disambiguation
const url = `http://www.omdbapi.com/?apikey=${key}&t=${title}&type=movie&y=${year}`;

// Or use search with corrections
const searchUrl = `http://www.omdbapi.com/?apikey=${key}&s=${title}&type=movie`;
```

#### 3. Parameter Validation Errors

**Response:**
```json
{
  "Response": "False",
  "Error": "Something went wrong."
}
```

**Causes:**
- Missing required parameters (no `i`, `t`, or `s`)
- Invalid parameter values
- Malformed query

**Solution:**
```javascript
function validateParams(params) {
  if (!params.i && !params.t && !params.s) {
    throw new Error("Must provide either 'i' (IMDb ID), 't' (title), or 's' (search)");
  }
  if (!params.apikey) {
    throw new Error("API key is required");
  }
}
```

### Recommended Error Handling Pattern

```javascript
async function fetchMovieData(params) {
  try {
    const response = await fetch(buildUrl(params));
    const data = await response.json();

    // Check API response status first
    if (data.Response === "False") {
      if (data.Error.includes("Invalid API key")) {
        throw new Error("INVALID_API_KEY");
      } else if (data.Error.includes("not found")) {
        throw new Error("MOVIE_NOT_FOUND");
      } else {
        throw new Error(data.Error);
      }
    }

    // Validate HTTP response
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return data;

  } catch (error) {
    if (error.message === "INVALID_API_KEY") {
      // Handle invalid key
      console.error("Please check your API key");
    } else if (error.message === "MOVIE_NOT_FOUND") {
      // Handle missing movie
      console.error("Movie not found - try a different title or year");
    } else {
      // Handle other errors
      console.error(`Error: ${error.message}`);
    }

    return null;
  }
}
```

### Error Handling for Different Scenarios

#### Handling Missing Ratings

```javascript
function safeGetRating(response, source) {
  if (!response.Ratings || !Array.isArray(response.Ratings)) {
    return "N/A";
  }

  const rating = response.Ratings.find(r => r.Source === source);
  return rating ? rating.Value : "N/A";
}

// Usage
const rtScore = safeGetRating(movieData, "Rotten Tomatoes");
if (rtScore === "N/A") {
  console.log("Rotten Tomatoes score not available");
}
```

#### Handling Pagination Errors

```javascript
async function safelyFetchPage(page, query, apiKey) {
  try {
    const response = await fetch(
      `http://www.omdbapi.com/?apikey=${apiKey}&s=${query}&page=${page}`
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.Response === "False") {
      return { success: false, results: [], error: data.Error };
    }

    return {
      success: true,
      results: data.Search || [],
      totalResults: parseInt(data.totalResults || 0)
    };
  } catch (error) {
    return {
      success: false,
      results: [],
      error: error.message
    };
  }
}
```

---

## Rate Limits & Best Practices

### Rate Limiting Information

**Current Status (as of 2025):**
- The OMDB API does not publicly document strict rate limits
- Free tier API keys have no officially stated limits
- However, reasonable usage patterns are expected

### Recommended Best Practices

#### 1. Request Caching

```javascript
const cache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function getCacheKey(params) {
  return JSON.stringify(params);
}

async function fetchWithCache(params) {
  const key = getCacheKey(params);
  const cached = cache.get(key);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const data = await fetch(buildUrl(params)).then(r => r.json());

  if (data.Response === "True") {
    cache.set(key, { data, timestamp: Date.now() });
  }

  return data;
}
```

#### 2. Batch Requests with Delays

```javascript
async function searchBatch(titles, apiKey, delayMs = 500) {
  const results = [];

  for (const title of titles) {
    try {
      const data = await fetchMovie(title, apiKey);
      results.push(data);

      // Add delay between requests
      await new Promise(resolve => setTimeout(resolve, delayMs));
    } catch (error) {
      console.error(`Failed to fetch ${title}: ${error.message}`);
    }
  }

  return results;
}
```

#### 3. Use IMDb IDs When Possible

```javascript
// BETTER: Direct ID lookup (faster, no ambiguity)
const url = `http://www.omdbapi.com/?apikey=${key}&i=tt0111161`;

// SLOWER: Title search (may need disambiguation)
const url = `http://www.omdbapi.com/?apikey=${key}&s=The%20Shawshank%20Redemption`;
```

#### 4. Handle Rate Limit Gracefully

```javascript
async function fetchWithRetry(params, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(buildUrl(params));
      const data = await response.json();

      if (data.Response === "True" || data.Error !== "Too many requests") {
        return data;
      }

      // Exponential backoff
      const waitTime = Math.pow(2, attempt - 1) * 1000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    } catch (error) {
      if (attempt === maxRetries) throw error;
    }
  }
}
```

#### 5. Minimize Data Requests

```javascript
// Get all needed data in one request
const url = `http://www.omdbapi.com/?apikey=${key}&i=${id}&plot=full`;

// Don't make separate requests for search then details
// Instead: Search → Get imdbID → Fetch details in next request
```

### Performance Optimization Tips

| Strategy | Benefit |
|---|---|
| Use IMDb IDs | Faster, more reliable lookups |
| Enable HTTP caching | Reduce identical requests |
| Cache responses locally | Improve app responsiveness |
| Use connection pooling | Better resource utilization |
| Batch requests with delays | Avoid rate limiting issues |
| Request only needed fields | Reduce data transfer |

---

## Complete Example Responses

### Movie Example: The Shawshank Redemption (Full Details)

**Request:**
```
http://www.omdbapi.com/?apikey=b9bd48a6&i=tt0111161&plot=full
```

**Response:**
```json
{
  "Title": "The Shawshank Redemption",
  "Year": "1994",
  "Rated": "R",
  "Released": "14 Oct 1994",
  "Runtime": "142 min",
  "Genre": "Drama",
  "Director": "Frank Darabont",
  "Writer": "Stephen King, Frank Darabont",
  "Actors": "Tim Robbins, Morgan Freeman, Bob Gunton",
  "Plot": "Chronicles the experiences of a formerly successful banker as a prisoner in the gloomy jailhouse of Shawshank after being found guilty of a crime he did not commit. The film portrays the man's unique way of dealing with his new, torturous life; along the way he befriends a number of fellow prisoners, most notably a wise long-term inmate named Red.",
  "Language": "English",
  "Country": "United States",
  "Awards": "Nominated for 7 Oscars. 21 wins & 42 nominations total",
  "Poster": "https://m.media-amazon.com/images/M/MV5BMDAyY2FhYjctNDc5OS00MDNlLThiMGUtY2UxYWVkNGY2ZjljXkEyXkFqcGc@._V1_SX300.jpg",
  "Ratings": [
    {
      "Source": "Internet Movie Database",
      "Value": "9.3/10"
    },
    {
      "Source": "Rotten Tomatoes",
      "Value": "89%"
    },
    {
      "Source": "Metacritic",
      "Value": "82/100"
    }
  ],
  "Metascore": "82",
  "imdbRating": "9.3",
  "imdbVotes": "3,120,594",
  "imdbID": "tt0111161",
  "Type": "movie",
  "DVD": "N/A",
  "BoxOffice": "$28,767,189",
  "Production": "N/A",
  "Website": "N/A",
  "Response": "True"
}
```

### TV Series Example: Breaking Bad (Full Details)

**Request:**
```
http://www.omdbapi.com/?apikey=b9bd48a6&t=Breaking%20Bad&type=series
```

**Response:**
```json
{
  "Title": "Breaking Bad",
  "Year": "2008–2013",
  "Rated": "TV-MA",
  "Released": "20 Jan 2008",
  "Runtime": "49 min",
  "Genre": "Crime, Drama, Thriller",
  "Director": "N/A",
  "Writer": "Vince Gilligan",
  "Actors": "Bryan Cranston, Anna Gunn, Aaron Paul",
  "Plot": "A chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing and selling methamphetamine with a former student to secure his family's future.",
  "Language": "English, Spanish",
  "Country": "United States",
  "Awards": "Won 16 Primetime Emmys. 172 wins & 269 nominations total",
  "Poster": "https://m.media-amazon.com/images/M/MV5BMzU5ZGYzNmQtMTdhYy00OGRiLTg0NmQtYjVjNzliZTg1ZGE4XkEyXkFqcGc@._V1_SX300.jpg",
  "Ratings": [
    {
      "Source": "Internet Movie Database",
      "Value": "9.5/10"
    },
    {
      "Source": "Rotten Tomatoes",
      "Value": "96%"
    }
  ],
  "Metascore": "N/A",
  "imdbRating": "9.5",
  "imdbVotes": "2,427,967",
  "imdbID": "tt0903747",
  "Type": "series",
  "totalSeasons": "5",
  "Response": "True"
}
```

### TV Series Search Results Example

**Request:**
```
http://www.omdbapi.com/?apikey=b9bd48a6&s=Breaking%20Bad&type=series
```

**Response:**
```json
{
  "Search": [
    {
      "Title": "Breaking Bad",
      "Year": "2008–2013",
      "imdbID": "tt0903747",
      "Type": "series",
      "Poster": "https://m.media-amazon.com/images/M/MV5BMzU5ZGYzNmQtMTdhYy00OGRiLTg0NmQtYjVjNzliZTg1ZGE4XkEyXkFqcGc@._V1_SX300.jpg"
    },
    {
      "Title": "Breaking Bad: Original Minisodes",
      "Year": "2009–2011",
      "imdbID": "tt2387761",
      "Type": "series",
      "Poster": "https://m.media-amazon.com/images/M/MV5BMzg4MTNiMGItZjFjOS00Y2ZmLWExMTktNzE3MDk1NDAwMGY3XkEyXkFqcGc@._V1_SX300.jpg"
    },
    {
      "Title": "Fixing Breaking Bad",
      "Year": "2013",
      "imdbID": "tt4516518",
      "Type": "series",
      "Poster": "https://m.media-amazon.com/images/M/MV5BYTI2MjQxZWEtNDEwNi00ZjM3LTlmZjEtNjc4MzAwMDA1YzFiXkEyXkFqcGc@._V1_SX300.jpg"
    }
  ],
  "totalResults": "5",
  "Response": "True"
}
```

### TV Episode Example: Game of Thrones Season 1 Episode 1

**Request:**
```
http://www.omdbapi.com/?apikey=b9bd48a6&t=Game%20of%20Thrones&Season=1&Episode=1
```

**Response:**
```json
{
  "Title": "Winter Is Coming",
  "Year": "2011",
  "Rated": "TV-MA",
  "Released": "17 Apr 2011",
  "Season": "1",
  "Episode": "1",
  "Runtime": "62 min",
  "Genre": "Action, Adventure, Drama",
  "Director": "Timothy Van Patten",
  "Writer": "David Benioff, D.B. Weiss, George R.R. Martin",
  "Actors": "Sean Bean, Mark Addy, Nikolaj Coster-Waldau",
  "Plot": "Lord Eddard Stark is concerned by news of a deserter from the Night's Watch; King Robert I Baratheon and the Lannisters arrive at Winterfell; the exiled Prince Viserys Targaryen forges a powerful new alliance.",
  "Language": "English",
  "Country": "United States",
  "Awards": "N/A",
  "Poster": "https://m.media-amazon.com/images/M/MV5BZDU5ZGEzODYtYWVlNC00NjYyLWJjOWYtYmNhZTc2MzUwYTliXkEyXkFqcGc@._V1_SX300.jpg",
  "Ratings": [
    {
      "Source": "Internet Movie Database",
      "Value": "8.9/10"
    }
  ],
  "Metascore": "N/A",
  "imdbRating": "8.9",
  "imdbVotes": "62238",
  "imdbID": "tt1480055",
  "seriesID": "tt0944947",
  "Type": "episode",
  "Response": "True"
}
```

### Search Results with Pagination Example (Batman, Page 1)

**Request:**
```
http://www.omdbapi.com/?apikey=b9bd48a6&s=Batman&page=1
```

**Response:**
```json
{
  "Search": [
    {
      "Title": "Batman Begins",
      "Year": "2005",
      "imdbID": "tt0372784",
      "Type": "movie",
      "Poster": "https://m.media-amazon.com/images/M/MV5BODIyMDdhNTgtNDlmOC00MjUxLWE2NDItODA5MTdkNzY3ZTdhXkEyXkFqcGc@._V1_SX300.jpg"
    },
    {
      "Title": "The Batman",
      "Year": "2022",
      "imdbID": "tt1877830",
      "Type": "movie",
      "Poster": "https://m.media-amazon.com/images/M/MV5BMmU5NGJlMzAtMGNmOC00YjJjLTgyMzUtNjAyYmE4Njg5YWMyXkEyXkFqcGc@._V1_SX300.jpg"
    },
    {
      "Title": "Batman v Superman: Dawn of Justice",
      "Year": "2016",
      "imdbID": "tt2975590",
      "Type": "movie",
      "Poster": "https://m.media-amazon.com/images/M/MV5BZTJkYjdmYjYtOGMyNC00ZGU1LThkY2ItYTc1OTVlMmE2YWY1XkEyXkFqcGc@._V1_SX300.jpg"
    },
    {
      "Title": "Batman",
      "Year": "1989",
      "imdbID": "tt0096895",
      "Type": "movie",
      "Poster": "https://m.media-amazon.com/images/M/MV5BYzZmZWViM2EtNzhlMi00NzBlLWE0MWEtZDFjMjk3YjIyNTBhXkEyXkFqcGc@._V1_SX300.jpg"
    },
    {
      "Title": "Batman Returns",
      "Year": "1992",
      "imdbID": "tt0103776",
      "Type": "movie",
      "Poster": "https://m.media-amazon.com/images/M/MV5BZTliMDVkYTktZDdlMS00NTAwLWJhNzYtMWIwMDZjN2ViMGFiXkEyXkFqcGc@._V1_SX300.jpg"
    },
    {
      "Title": "Batman & Robin",
      "Year": "1997",
      "imdbID": "tt0118688",
      "Type": "movie",
      "Poster": "https://m.media-amazon.com/images/M/MV5BYzU3ZjE3M2UtM2E4Ni00MDI5LTkyZGUtOTFkMGIyYjNjZGU3XkEyXkFqcGc@._V1_SX300.jpg"
    },
    {
      "Title": "Batman Forever",
      "Year": "1995",
      "imdbID": "tt0112462",
      "Type": "movie",
      "Poster": "https://m.media-amazon.com/images/M/MV5BMTUyNjJhZWItMTZkNS00NDc4LTllNjUtYTg3NjczMzA5ZTViXkEyXkFqcGc@._V1_SX300.jpg"
    },
    {
      "Title": "The Lego Batman Movie",
      "Year": "2017",
      "imdbID": "tt4116284",
      "Type": "movie",
      "Poster": "https://m.media-amazon.com/images/M/MV5BMTcyNTEyOTY0M15BMl5BanBnXkFtZTgwOTAyNzU3MDI@._V1_SX300.jpg"
    },
    {
      "Title": "Batman: The Animated Series",
      "Year": "1992–1995",
      "imdbID": "tt0103359",
      "Type": "series",
      "Poster": "https://m.media-amazon.com/images/M/MV5BYjgwZWUzMzUtYTFkNi00MzM0LWFkMWUtMDViMjMxNGIxNDUxXkEyXkFqcGc@._V1_SX300.jpg"
    },
    {
      "Title": "Batman: Year One",
      "Year": "2011",
      "imdbID": "tt1672723",
      "Type": "movie",
      "Poster": "https://m.media-amazon.com/images/M/MV5BNTJjMmVkZjctNjNjMS00ZmI2LTlmYWEtOWNiYmQxYjY0YWVhXkEyXkFqcGdeQXVyNTAyODkwOQ@@._V1_SX300.jpg"
    }
  ],
  "totalResults": "622",
  "Response": "True"
}
```

### Error Response Examples

**Invalid API Key:**
```json
{
  "Response": "False",
  "Error": "Invalid API key!"
}
```

**Movie Not Found:**
```json
{
  "Response": "False",
  "Error": "Movie not found!"
}
```

**Missing Required Parameters:**
```json
{
  "Response": "False",
  "Error": "Something went wrong."
}
```

---

## Summary

This comprehensive reference covers all aspects of the OMDB API for your Netflix extension project. Key takeaways:

### Quick Reference

- **Search Endpoint:** `/apikey=[key]&s=[query]&[optional filters]`
- **Exact Match:** `/apikey=[key]&t=[title]&[optional filters]` or `&i=[id]`
- **IMDb Rating:** Direct field `imdbRating` or in `Ratings` array
- **Metacritic:** Direct field `Metascore` or in `Ratings` array
- **Rotten Tomatoes:** Only in `Ratings` array, search for `Source: "Rotten Tomatoes"`

### For Implementation

1. Cache responses locally to minimize API calls
2. Always check `Response: "True"` before processing data
3. Validate rating availability (use N/A as fallback)
4. Use IMDb IDs for direct lookups when possible
5. Implement proper error handling with exponential backoff

### Important Notes

- The API key `b9bd48a6` is provided for testing
- All examples use real API responses captured on 2025-11-19
- Not all ratings are available for all titles
- Search results are limited to 10 per page (max 100 pages)

