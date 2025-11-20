# OMDB API Documentation Index

Complete reference documentation for integrating the Open Movie Database (OMDB) API into your Netflix extension project.

**Last Updated:** November 19, 2025
**API Key:** b9bd48a6 (provided for testing)
**Base URL:** http://www.omdbapi.com/

---

## Documentation Files

### 1. **omdb-api-reference.md** (COMPREHENSIVE)
Complete technical reference with all API details, parameters, and response structures.

**Contents:**
- Full API endpoint structure and parameter documentation
- Authentication setup and security best practices
- Complete response field reference for movies, series, and episodes
- Detailed ratings extraction guide for IMDb, Metacritic, and Rotten Tomatoes
- Extensive code examples in JavaScript and Python
- Complete error handling guide with solutions
- Rate limits and performance optimization tips
- Real example responses for all content types

**Start here for:** Deep understanding of all API capabilities

---

### 2. **omdb-quick-reference.md** (QUICK LOOKUP)
Fast reference guide for developers during implementation.

**Contents:**
- API endpoints at a glance
- Ratings extraction quick guide
- Common code patterns
- Response structure quick guide
- Parameter cheat sheet
- Testing commands with curl
- Common gotchas and edge cases

**Start here for:** Quick lookup during development

---

### 3. **omdb-implementation-examples.md** (CODE EXAMPLES)
Production-ready code implementations in multiple languages.

**Contents:**
- Complete JavaScript/Node.js service module with full feature set
- Complete Python service module with full feature set
- Integration examples for Express.js
- Integration examples for Flask
- Unit test examples for both languages
- Language comparison and selection guide

**Start here for:** Copy-paste ready code to integrate into your project

---

## Quick Start

### Installation

No installation needed - the OMDB API is accessed via HTTP REST endpoints.

### Basic Example (JavaScript)

```javascript
// Search for a movie
const response = await fetch(
  'http://www.omdbapi.com/?apikey=b9bd48a6&s=Inception'
);
const data = await response.json();

if (data.Response === "True") {
  console.log(`Found ${data.totalResults} results`);
  data.Search.forEach(movie => {
    console.log(`- ${movie.Title} (${movie.Year})`);
  });
}
```

### Basic Example (Python)

```python
import requests

response = requests.get(
    'http://www.omdbapi.com/',
    params={
        'apikey': 'b9bd48a6',
        's': 'Inception'
    }
)
data = response.json()

if data.get('Response') == 'True':
    print(f"Found {data['totalResults']} results")
```

---

## Ratings Extraction

The most important feature for your Netflix extension - extracting ratings from multiple sources:

### IMDb Rating
```javascript
const imdbScore = movie.imdbRating;  // "9.3"
const imdbVotes = movie.imdbVotes;   // "3,120,594"
```

### Metacritic Score
```javascript
const metacriticScore = movie.Metascore;  // "82" or "N/A"
```

### Rotten Tomatoes Score
```javascript
const rt = movie.Ratings?.find(r => r.Source === "Rotten Tomatoes");
const rtScore = rt?.Value;  // "89%"
```

For a complete extraction function, see **omdb-quick-reference.md** or **omdb-implementation-examples.md**.

---

## API Endpoints Summary

| Endpoint | Parameters | Returns |
|---|---|---|
| **Search** | `s` (query) | List of matches (paginated) |
| **Get by Title** | `t` (title) | Single movie/series (full details) |
| **Get by ID** | `i` (IMDb ID) | Single movie/series (full details) |
| **Get Episode** | `t`/`i` + `Season` + `Episode` | Episode details |

All requests require:
- `apikey` parameter with your API key
- Response format: JSON or XML (default: JSON)

---

## Key Features

### Search & Discovery
- Search movies, TV series, and episodes
- Filter by type (movie/series/episode)
- Filter by release year
- Pagination support (10 results per page, up to 100 pages)
- Exact match by IMDb ID or title

### Ratings from Multiple Sources
- IMDb Rating (0.0-10.0 scale)
- Metacritic Score (0-100 scale)
- Rotten Tomatoes Score (0-100% scale)

### Comprehensive Data
- Plot summaries (short and full versions)
- Cast and crew information
- Runtime and genres
- Awards and nominations
- Box office and production info
- Poster images

### TV Series Support
- Episode-specific information
- Season and episode queries
- Series metadata (total seasons, etc.)
- Individual episode ratings

---

## Implementation Recommendations

### For Netflix Extension (Chrome/Browser)

1. **Use the JavaScript module** from `omdb-implementation-examples.md`
2. **Implement caching** to minimize API calls
3. **Handle errors gracefully** - not all titles have all ratings
4. **Use IMDb IDs** when possible for faster, more reliable lookups

### Code Organization

Create a service module:
```
src/
├── services/
│   └── omdb/
│       ├── omdb-service.js    (from examples)
│       ├── types.js            (TypeScript definitions)
│       └── constants.js         (API URLs, constants)
├── hooks/
│   └── useOmdb.js             (React hook wrapper)
└── components/
    └── MovieDetails.js         (UI component using service)
```

### Testing Strategy

1. Start with IMDb ID lookups (tt prefixed IDs)
2. Test title-based searches with year filter
3. Validate rating extraction with known titles
4. Implement error handling before production

---

## Common Tasks

### Task 1: Get Full Movie Details

**What:** Get complete information about a specific movie including all ratings

**How:** Use `getById()` or `getByTitle()` with full plot

**Example:**
```javascript
const movie = await omdb.getById('tt0111161', { plot: 'full' });
const ratings = omdb.extractRatings(movie);
console.log(`${movie.Title}: ${omdb.formatRatings(ratings)}`);
```

See: **omdb-implementation-examples.md** → "Complete Movie Service Module"

---

### Task 2: Search for Content

**What:** Find movies/series matching a user query

**How:** Use `search()` with optional type and year filters

**Example:**
```javascript
const results = await omdb.search('Batman', {
  type: 'movie',
  year: 2005
});
```

See: **omdb-quick-reference.md** → "Basic Movie Search"

---

### Task 3: Extract and Display Ratings

**What:** Get ratings from all available sources in a usable format

**How:** Call `extractRatings()` and `formatRatings()` methods

**Example:**
```javascript
const ratings = omdb.extractRatings(movieData);
const display = omdb.formatRatings(ratings);
// Output: "IMDb: 9.3/10 | MC: 82/100 | RT: 89%"
```

See: **omdb-quick-reference.md** → "Ratings Extraction"

---

### Task 4: Get TV Series Information

**What:** Retrieve details about a TV series

**How:** Use `getByTitle()` with type='series' or `getById()`

**Example:**
```javascript
const series = await omdb.getByTitle('Breaking Bad', { type: 'series' });
console.log(`${series.Title}: ${series.totalSeasons} seasons`);
```

See: **omdb-quick-reference.md** → "Common Code Patterns"

---

### Task 5: Get Episode Details

**What:** Get information about a specific TV episode

**How:** Use `getEpisode()` method with season and episode numbers

**Example:**
```javascript
const episode = await omdb.getEpisode('Game of Thrones', 1, 1);
console.log(`${episode.Title} - Rating: ${episode.imdbRating}/10`);
```

See: **omdb-implementation-examples.md** → "Get TV Series Episode Details"

---

## Error Handling Guide

### Common Errors

| Error | Cause | Solution |
|---|---|---|
| "Invalid API key!" | Missing or wrong API key | Check your OMDB_API_KEY env var |
| "Movie not found!" | Title doesn't exist | Try different title or use IMDb ID |
| "Something went wrong." | Missing search parameters | Ensure you have `i`, `t`, or `s` param |

### Handling Missing Ratings

Not all titles have ratings from all sources. Always check for "N/A" values:

```javascript
if (movie.Metascore && movie.Metascore !== "N/A") {
  console.log(`Metacritic: ${movie.Metascore}/100`);
} else {
  console.log("Metacritic score not available");
}
```

---

## Rate Limits

The OMDB API does not publish strict rate limits for free accounts. However, follow these best practices:

1. **Cache responses** - Store results for 24 hours
2. **Add delays** - Wait 500ms between batch requests
3. **Use IMDb IDs** - Direct lookups are faster
4. **Avoid duplicates** - Check cache before making API call

---

## Testing with curl

Quick testing commands for validation:

```bash
# Search for movies
curl "http://www.omdbapi.com/?apikey=b9bd48a6&s=Inception"

# Get movie by ID
curl "http://www.omdbapi.com/?apikey=b9bd48a6&i=tt1375666"

# Get TV series
curl "http://www.omdbapi.com/?apikey=b9bd48a6&t=Breaking%20Bad&type=series"

# Get episode
curl "http://www.omdbapi.com/?apikey=b9bd48a6&t=Game%20of%20Thrones&Season=1&Episode=1"
```

---

## Troubleshooting

### Issue: "Movie not found!" but I know the movie exists

**Solutions:**
1. Try different spelling or shorter title
2. Add year filter to disambiguate
3. Use IMDb ID if you have it
4. Check if it's actually a TV series (use type=series)

### Issue: Ratings show "N/A" for some titles

**Expected behavior:** Not all titles have ratings from all sources. This is normal, especially for:
- Very recent releases
- TV series (often missing Metacritic)
- Obscure or older content

### Issue: Search returns too many results

**Solutions:**
1. Add type filter: `&type=movie`
2. Add year filter: `&y=2023`
3. Use pagination: `&page=2` for more results
4. Use more specific search query

### Issue: API calls are slow

**Solutions:**
1. Implement response caching
2. Use IMDb IDs instead of title search
3. Add 500ms delay between batch requests
4. Minimize plot request to 'short' (default)

---

## API Data Freshness

- **Last Updated:** November 19, 2025
- **OMDB Database:** Continuously updated by community contributors
- **Ratings:** Updated as users rate content on IMDb, Rotten Tomatoes, Metacritic
- **Response Examples:** All tested with real API on 2025-11-19

---

## Additional Resources

### Official Links
- Main Site: http://www.omdbapi.com/
- OpenAPI Spec: http://www.omdbapi.com/swagger.yaml
- GitHub Issues: https://github.com/omdbapi/OMDb-API/issues

### Related Documentation
- IMDb API (different service): https://www.imdb.com/interfaces/
- Rotten Tomatoes (different service): https://www.rottentomatoes.com/api/

---

## Summary

You now have everything needed to integrate OMDB API into your Netflix extension:

1. **omdb-api-reference.md** - All technical details
2. **omdb-quick-reference.md** - Quick lookup guide
3. **omdb-implementation-examples.md** - Copy-paste ready code

Start with the quick reference for common tasks, refer to the full reference for details, and use the implementation examples for copy-paste code.

**Happy coding!**

