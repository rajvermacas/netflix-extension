# OMDB API Quick Reference Guide

Fast lookup for common OMDB API operations.

---

## API Endpoints at a Glance

### Search for Movies/Series
```
GET http://www.omdbapi.com/?apikey=KEY&s=QUERY&type=FILTER&page=NUM
```
- Returns: List of up to 10 matches + totalResults count
- Paginated: 1-100 pages available
- Type filter: movie, series, episode (optional)

### Get Details by Title
```
GET http://www.omdbapi.com/?apikey=KEY&t=TITLE&y=YEAR&type=movie
```
- Returns: Single full result with complete details
- Year filter: helps disambiguate duplicate titles (optional)

### Get Details by IMDb ID
```
GET http://www.omdbapi.com/?apikey=KEY&i=tt1234567
```
- Returns: Single full result (most reliable)
- No ambiguity regardless of title

### Get Episode Details
```
GET http://www.omdbapi.com/?apikey=KEY&t=SERIES&Season=1&Episode=1
```
- Or: `i=SERIES_ID&Season=1&Episode=1`
- Returns: Episode-specific information

---

## Ratings Extraction (The Most Important Part)

### IMDb Rating
```
response.imdbRating        → "9.3"
response.imdbVotes         → "3,120,594"
```
Always available for movies/series.

### Metacritic Score
```
response.Metascore         → "82" or "N/A"
```
Check value - may be missing for some titles.

### Rotten Tomatoes Score
```
const rt = response.Ratings?.find(r => r.Source === "Rotten Tomatoes");
rt?.Value                  → "89%"
```
Only in Ratings array. May be missing for some titles.

### Safe Extraction Function
```javascript
function getRatings(movie) {
  return {
    imdb: movie.imdbRating !== "N/A" ? parseFloat(movie.imdbRating) : null,
    metacritic: movie.Metascore !== "N/A" ? parseInt(movie.Metascore) : null,
    rottenTomatoes: (() => {
      const rt = movie.Ratings?.find(r => r.Source === "Rotten Tomatoes");
      return rt ? parseInt(rt.Value) : null;
    })()
  };
}
```

---

## Common Code Patterns

### Basic Movie Search
```javascript
const url = `http://www.omdbapi.com/?apikey=b9bd48a6&s=Inception`;
const data = await fetch(url).then(r => r.json());

if (data.Response === "True") {
  data.Search.forEach(movie => {
    console.log(`${movie.Title} (${movie.Year}) - ${movie.imdbID}`);
  });
}
```

### Get Movie by IMDb ID
```javascript
const url = `http://www.omdbapi.com/?apikey=b9bd48a6&i=tt1375666&plot=full`;
const data = await fetch(url).then(r => r.json());

if (data.Response === "True") {
  const ratings = getRatings(data);
  console.log(`${data.Title} - IMDb: ${ratings.imdb}/10`);
}
```

### Get Full Results List (All Pages)
```javascript
async function getAllResults(query) {
  let allResults = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && page <= 100) {
    const url = `http://www.omdbapi.com/?apikey=KEY&s=${query}&page=${page}`;
    const data = await fetch(url).then(r => r.json());

    if (data.Response === "False") break;

    allResults = allResults.concat(data.Search);
    totalPages = Math.ceil(parseInt(data.totalResults) / 10);
    page++;
  }

  return allResults;
}
```

### Handle Errors Properly
```javascript
async function safeGetMovie(movieId) {
  try {
    const url = `http://www.omdbapi.com/?apikey=b9bd48a6&i=${movieId}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.Response === "False") {
      console.error(`API Error: ${data.Error}`);
      return null;
    }

    if (!response.ok) {
      console.error(`HTTP Error: ${response.status}`);
      return null;
    }

    return data;
  } catch (error) {
    console.error(`Network error: ${error.message}`);
    return null;
  }
}
```

---

## Response Structure Quick Guide

### Search Result Item
```json
{
  "Title": "Movie Name",
  "Year": "2024",
  "imdbID": "tt1234567",
  "Type": "movie",
  "Poster": "https://..."
}
```

### Full Movie Result
```json
{
  "Title": "Movie Name",
  "Year": "2024",
  "Rated": "PG-13",
  "Released": "01 Jan 2024",
  "Runtime": "120 min",
  "Genre": "Action, Sci-Fi",
  "Director": "Director Name",
  "Actors": "Actor1, Actor2",
  "Plot": "Short plot summary",
  "Language": "English",
  "Country": "United States",
  "Awards": "Award info",
  "Poster": "https://...",
  "Ratings": [
    {"Source": "Internet Movie Database", "Value": "8.5/10"},
    {"Source": "Rotten Tomatoes", "Value": "89%"},
    {"Source": "Metacritic", "Value": "75/100"}
  ],
  "Metascore": "75",
  "imdbRating": "8.5",
  "imdbVotes": "150,000",
  "imdbID": "tt1234567",
  "Type": "movie",
  "Response": "True"
}
```

### TV Series Result
```json
{
  "Title": "Series Name",
  "Year": "2020–2024",
  "Rated": "TV-MA",
  "Released": "01 Jan 2020",
  "Runtime": "60 min",
  "Genre": "Drama, Thriller",
  "Writer": "Creator Name",
  "Actors": "Actor1, Actor2",
  "Plot": "Series plot summary",
  "Language": "English",
  "Country": "United States",
  "Awards": "Award info",
  "Poster": "https://...",
  "Ratings": [
    {"Source": "Internet Movie Database", "Value": "9.0/10"},
    {"Source": "Rotten Tomatoes", "Value": "95%"}
  ],
  "Metascore": "N/A",
  "imdbRating": "9.0",
  "imdbVotes": "500,000",
  "imdbID": "tt7654321",
  "Type": "series",
  "totalSeasons": "5",
  "Response": "True"
}
```

### Episode Result
```json
{
  "Title": "Episode Title",
  "Season": "1",
  "Episode": "1",
  "Year": "2020",
  "Released": "01 Jan 2020",
  "Runtime": "60 min",
  "Plot": "Episode plot",
  "imdbRating": "8.7",
  "imdbVotes": "50,000",
  "imdbID": "tt9876543",
  "seriesID": "tt7654321",
  "Type": "episode",
  "Response": "True"
}
```

---

## URL Building Helper

```javascript
function buildOmdbUrl(params) {
  const baseUrl = "http://www.omdbapi.com/";
  const defaultParams = {
    apikey: process.env.OMDB_API_KEY || "b9bd48a6",
    r: "json"
  };

  const finalParams = { ...defaultParams, ...params };
  const query = new URLSearchParams(finalParams).toString();

  return `${baseUrl}?${query}`;
}

// Usage:
const searchUrl = buildOmdbUrl({ s: "Inception", type: "movie" });
const detailUrl = buildOmdbUrl({ i: "tt1375666", plot: "full" });
const episodeUrl = buildOmdbUrl({ t: "Game of Thrones", Season: 1, Episode: 1 });
```

---

## Parameter Cheat Sheet

| Use Case | Required Params | Optional Params |
|---|---|---|
| Search | `s` | `type`, `y`, `page` |
| Get by Title | `t` | `y`, `type`, `plot` |
| Get by ID | `i` | `plot` |
| Get Episode | `t` or `i` + `Season` + `Episode` | `plot` |

All requests need `apikey`!

---

## Error Codes

| Error | Meaning | Fix |
|---|---|---|
| "Invalid API key!" | API key missing or wrong | Check your key |
| "Movie not found!" | Title doesn't exist in OMDB | Try different title/year |
| "Something went wrong." | Missing required parameters | Add `i`, `t`, or `s` |

---

## Testing Commands

```bash
# Search for a movie
curl "http://www.omdbapi.com/?apikey=b9bd48a6&s=Inception"

# Get movie details
curl "http://www.omdbapi.com/?apikey=b9bd48a6&i=tt1375666"

# Get TV series
curl "http://www.omdbapi.com/?apikey=b9bd48a6&t=Breaking%20Bad&type=series"

# Get episode
curl "http://www.omdbapi.com/?apikey=b9bd48a6&t=Game%20of%20Thrones&Season=1&Episode=1"

# Search with pagination
curl "http://www.omdbapi.com/?apikey=b9bd48a6&s=Batman&page=2"
```

---

## Performance Tips

1. **Cache responses** - OMDB data doesn't change frequently
2. **Use IMDb IDs** - Direct lookup is faster and more reliable
3. **Batch requests** - Add 500ms delay between requests
4. **Lazy load ratings** - Don't fetch full details for search results
5. **Handle N/A values** - Not all titles have all ratings

---

## Common Gotchas

1. **Ratings not guaranteed** - Not all titles have Metacritic or RT scores
2. **Search returns 10 max** - Use pagination for more results
3. **Space encoding** - Use %20 or + for spaces in URLs
4. **Case sensitive error check** - Check `data.Response === "True"` (string)
5. **TV Series have no Metascore** - Most series return N/A for Metacritic

