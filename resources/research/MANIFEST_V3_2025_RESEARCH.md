# Chrome Extension Manifest V3 Specifications and Best Practices Research
## Comprehensive Guide for 2025

**Research Date:** November 19, 2025
**Status:** Current as of Chrome 88+
**Target:** Modern Chrome Extension Development (MV3)

---

## Executive Summary

Chrome Extension Manifest V3 (MV3) is the current required version for publishing extensions to the Chrome Web Store. As of June 2025, all Manifest V2 extensions have been removed from the Chrome Web Store. This research document provides comprehensive guidance on implementing MV3 extensions with a focus on best practices, security, and performance.

**Key Requirements:**
- Service workers replace background pages
- No remotely-hosted code execution
- Strong Content Security Policy (CSP) requirements
- Host permissions separated from general permissions
- Message-based communication between contexts

---

## Part 1: Required Manifest V3 Structure and Fields

### 1.1 Minimal Manifest

Every MV3 extension requires these three core fields:

```json
{
  "manifest_version": 3,
  "name": "Your Extension Name",
  "version": "1.0.0"
}
```

### 1.2 Complete Required Fields

For Chrome Web Store submission, include these additional required fields:

```json
{
  "manifest_version": 3,
  "name": "Netflix Extension",
  "version": "1.0.0",
  "description": "Enhance your Netflix experience with movie metadata and ratings",
  "icons": {
    "16": "images/icon-16.png",
    "48": "images/icon-48.png",
    "128": "images/icon-128.png"
  }
}
```

### 1.3 Field Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `manifest_version` | integer | Yes | Must be 3 for MV3 extensions |
| `name` | string | Yes | Extension name (max 75 characters). Displayed in Chrome Web Store and chrome://extensions |
| `version` | string | Yes | Version number in format "major.minor.patch" |
| `description` | string | Required for Web Store | Brief description (max 132 characters) |
| `icons` | object | Required for Web Store | Icon files at 16x16, 48x48, 128x128 pixels minimum |
| `background` | object | Optional | Defines service worker for background operations |
| `content_scripts` | array | Optional | Scripts that run in context of web pages |
| `permissions` | array | Optional | API permissions (non-host permissions) |
| `host_permissions` | array | Optional | URL patterns for accessing specific domains |
| `action` | object | Optional | Extension icon and popup in toolbar |
| `commands` | object | Optional | Keyboard shortcuts |
| `content_security_policy` | object | Optional | Security policy directives |
| `web_accessible_resources` | array | Optional | Resources that web pages can access |
| `default_locale` | string | Conditional | Required if extension supports multiple languages |

### 1.4 Common Optional Fields

```json
{
  "manifest_version": 3,
  "name": "Netflix Extension",
  "version": "1.0.0",
  "description": "Enhance Netflix with movie metadata and ratings",
  "icons": {
    "16": "images/icon-16.png",
    "48": "images/icon-48.png",
    "128": "images/icon-128.png"
  },
  "background": {
    "service_worker": "service-worker.js"
  },
  "content_scripts": [
    {
      "matches": ["https://www.netflix.com/*"],
      "js": ["content-script.js"],
      "run_at": "document_start"
    }
  ],
  "permissions": ["storage", "scripting"],
  "host_permissions": [
    "https://www.netflix.com/*",
    "https://www.omdbapi.com/*"
  ],
  "action": {
    "default_title": "Netflix Extension",
    "default_icon": "images/icon-48.png",
    "default_popup": "popup.html"
  },
  "content_security_policy": {
    "extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';"
  },
  "web_accessible_resources": [
    {
      "resources": ["injected-script.js"],
      "matches": ["https://www.netflix.com/*"]
    }
  ]
}
```

---

## Part 2: Permissions Architecture

### 2.1 Permission Types Overview

MV3 distinguishes between three types of permissions:

1. **API Permissions** - Access to Chrome extension APIs
2. **Host Permissions** - Access to specific websites
3. **Optional Permissions** - User grants permissions at runtime

### 2.2 Common API Permissions

```json
{
  "permissions": [
    "storage",          // chrome.storage API
    "scripting",        // chrome.scripting API for dynamic injection
    "tabs",             // chrome.tabs API (read-only by default)
    "contextMenus",     // chrome.contextMenus API
    "alarms",           // chrome.alarms API
    "webRequest",       // Monitoring web requests (limited)
    "offscreen"         // Create offscreen documents
  ]
}
```

### 2.3 Host Permissions for Netflix and External APIs

Host permissions use match patterns to specify which URLs the extension can access:

```json
{
  "host_permissions": [
    "https://*.netflix.com/*",       // Netflix and subdomains
    "https://www.omdbapi.com/*",     // OMDb API
    "https://api.themoviedb.org/*"   // TMDB API (alternative)
  ]
}
```

#### Match Pattern Syntax

```
<scheme>://<host>/<path>
```

**Examples:**
```
https://*.netflix.com/*          // Netflix and all subdomains
https://www.omdbapi.com/         // Specific domain
https://api.*.example.com/*      // Subdomains under example.com
*://mail.google.com/*            // Both http and https
file:///foo*                      // Local file access
http://127.0.0.1/*               // Localhost
```

### 2.4 activeTab Permission (Recommended for Security)

Instead of requesting persistent host permissions, use `activeTab` for temporary access:

```json
{
  "permissions": ["activeTab", "scripting"],
  "background": {
    "service_worker": "service-worker.js"
  },
  "action": {
    "default_title": "Click to analyze Netflix page"
  }
}
```

**Benefits of activeTab:**
- No permission warning during installation
- Temporary access - only active when extension is invoked
- Access revoked when user navigates away
- Better security posture

### 2.5 Optional Permissions (Runtime Request)

Request additional permissions only when needed:

```json
{
  "permissions": ["storage"],
  "optional_permissions": ["tabs"],
  "optional_host_permissions": ["https://*.netflix.com/*"]
}
```

Request in code:
```javascript
// Only works inside user gesture handler
document.getElementById('enable-analytics').addEventListener('click', () => {
  chrome.permissions.request({
    permissions: ['tabs'],
    origins: ['https://*.netflix.com/*']
  }, (granted) => {
    if (granted) {
      console.log('User granted permissions');
    }
  });
});
```

### 2.6 Permission Warnings to Avoid During Updates

Permissions that DON'T trigger warnings when added:
- `storage`
- `scripting`
- `contextMenus`
- `alarms`
- `offscreen`

Permissions that DO trigger warnings:
- Host permissions
- `tabs`
- `webRequest`
- `management`

---

## Part 3: Content Script Injection for Netflix

### 3.1 Static Declarative Injection (Automatic)

Declare scripts that run automatically on page load:

```json
{
  "content_scripts": [
    {
      "matches": ["https://www.netflix.com/*"],
      "js": ["content-script.js"],
      "css": ["content-styles.css"],
      "run_at": "document_start",
      "world": "ISOLATED"
    }
  ]
}
```

**Key Properties:**

| Property | Values | Default | Purpose |
|----------|--------|---------|---------|
| `matches` | array | Required | URL patterns where script runs |
| `js` | array | Optional | JavaScript files to inject |
| `css` | array | Optional | CSS files to inject |
| `run_at` | `document_start` \| `document_end` \| `document_idle` | `document_idle` | When to inject script |
| `world` | `ISOLATED` \| `MAIN` | `ISOLATED` | Execution context |
| `match_about_blank` | boolean | false | Inject in about:blank frames |

### 3.2 Run-at Timing

```
document_start   - Before any DOM is constructed (earliest)
                 - Access to document and window
                 - Use for: DOM monitoring, early access
                 - Risk: Page may not be fully loaded

document_end     - After DOM construction, before subresources load
                 - Use for: DOM manipulation
                 - Faster than document_idle

document_idle    - After window.onload fires (default)
                 - Use for: Safe general-purpose injection
                 - Ensures page is fully loaded
```

### 3.3 Dynamic Programmatic Injection (On-Demand)

For conditional injection based on user interaction or page state:

**Service Worker (service-worker.js):**
```javascript
// Inject script when user clicks extension icon
chrome.action.onClicked.addListener((tab) => {
  // Check if we can inject (requires activeTab or host_permissions)
  if (!tab.url.includes('netflix.com')) {
    console.log('Not on Netflix, skipping injection');
    return;
  }

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content-script.js']
  });
});
```

**Or inject function directly:**
```javascript
chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      // Self-contained function - cannot reference outer scope
      document.body.style.backgroundColor = 'red';
      console.log('Page modified');
    }
  });
});
```

**Pass arguments to injected function:**
```javascript
chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (color, message) => {
      document.body.style.backgroundColor = color;
      console.log(message);
    },
    args: ['orange', 'Netflix page enhanced!']
  });
});
```

### 3.4 Dynamic Script Registration (Chrome 96+)

Register content scripts that are not in manifest:

**Service Worker:**
```javascript
// Register dynamic content script
chrome.scripting.registerContentScripts([{
  id: "netflix-analyzer",
  js: ["content-script.js"],
  matches: ["*://netflix.com/*"],
  persistAcrossSessions: false,  // Only until browser closes
  runAt: "document_start"
}])
  .then(() => console.log("Script registered"))
  .catch((err) => console.error("Failed to register:", err));

// Later: Unregister when no longer needed
chrome.scripting.unregisterContentScripts({ ids: ["netflix-analyzer"] });

// Check registered scripts
chrome.scripting.getRegisteredContentScripts()
  .then(scripts => console.log("Registered scripts:", scripts));

// Update existing registration
chrome.scripting.updateContentScripts([{
  id: "netflix-analyzer",
  excludeMatches: ["*://netflix.com/admin/*"]
}]);
```

### 3.5 Execution Worlds: ISOLATED vs MAIN

**ISOLATED World (Default):**
```javascript
// Runs in isolated context, cannot access page variables
var greeting = "hello";  // isolated to extension
console.log(window.pageVariable);  // undefined - cannot access page
```

**When to use ISOLATED:**
- Safe DOM manipulation
- Listening to extension events
- General purpose content scripts

**MAIN World:**
```json
{
  "content_scripts": [
    {
      "matches": ["https://www.netflix.com/*"],
      "js": ["main-world-script.js"],
      "world": "MAIN"
    }
  ]
}
```

**When to use MAIN:**
- Must intercept page API calls
- Must access page JavaScript variables/functions
- Monitoring Netflix API calls for movie data

**Warning:** MAIN world scripts execute alongside page scripts - use with caution.

### 3.6 Netflix-Specific Injection Example

**manifest.json:**
```json
{
  "manifest_version": 3,
  "name": "Netflix Metadata Extractor",
  "version": "1.0.0",
  "description": "Extract movie metadata from Netflix",
  "permissions": ["storage", "scripting"],
  "host_permissions": [
    "https://www.netflix.com/*",
    "https://www.omdbapi.com/*"
  ],
  "content_scripts": [
    {
      "matches": ["https://www.netflix.com/*"],
      "js": ["content-script.js"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_title": "Get movie info"
  }
}
```

**content-script.js:**
```javascript
// In isolated world - can access extension APIs and DOM
console.log('Content script running on Netflix');

// Get title from page DOM
const movieTitle = document.querySelector('[class*="title"]')?.textContent;

if (movieTitle) {
  // Send message to service worker for API call
  chrome.runtime.sendMessage(
    { type: 'FETCH_METADATA', title: movieTitle },
    (response) => {
      console.log('Movie metadata:', response);
    }
  );
}
```

---

## Part 4: Service Workers in Manifest V3

### 4.1 Service Worker vs Background Script

**MV2 (Deprecated):**
```json
{
  "background": {
    "scripts": ["background.js"],
    "persistent": false  // Event page (could persist indefinitely)
  }
}
```

**MV3 (Current):**
```json
{
  "background": {
    "service_worker": "service-worker.js"
  }
}
```

### 4.2 Service Worker Lifecycle

The extension service worker goes through these stages:

**Installation Phase:**
1. `install` event fires
2. `chrome.runtime.onInstalled` event fires
3. `activate` event fires
4. Service worker is ready for events

**Runtime Phase:**
- Service worker loads when needed
- Handles events (tab updates, clicks, messages)
- Unloads after inactivity

**Termination Conditions:**
- **30 seconds of inactivity** - No events or API calls
- **5 minutes of single request** - Long-running operation timeout
- **30 seconds for fetch** - Network request timeout

```javascript
// service-worker.js

// Register listeners at TOP LEVEL (synchronously!)
console.log('Service worker loading...');

// Good: Listeners registered immediately
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed/updated');
  if (details.reason === 'install') {
    chrome.storage.local.set({ firstRun: true });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received:', request);

  if (request.type === 'GET_DATA') {
    // Handle async work properly
    handleAsyncTask()
      .then(result => sendResponse({ data: result }))
      .catch(err => sendResponse({ error: err.message }));

    // Return true to keep channel open for async response
    return true;
  }
});

// Bad: Don't do this
setTimeout(() => {
  // THIS LISTENER MIGHT NOT BE REGISTERED IF SERVICE WORKER UNLOADS
  chrome.runtime.onMessage.addListener(/*...*/);
}, 1000);

// Good: Use async function at top level
async function handleAsyncTask() {
  try {
    const response = await fetch('https://api.example.com/data');
    return await response.json();
  } catch (error) {
    console.error('Fetch failed:', error);
    throw error;
  }
}
```

### 4.3 Persistent Data in Service Workers

Service workers are stateless - they unload frequently. Store data externally:

```javascript
// BAD: Uses global variable - data lost on unload
let movieCache = {};

chrome.runtime.onMessage.addListener((request) => {
  movieCache[request.id] = request.data;  // LOST if service worker unloads
});

// GOOD: Use chrome.storage API
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'CACHE_MOVIE') {
    const cacheData = {};
    cacheData[request.movieId] = request.movieData;

    chrome.storage.local.set(cacheData)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ error: err.message }));

    return true;  // Keep channel open
  }
});

// Retrieve from storage
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.type === 'GET_CACHED_MOVIE') {
    const { movieId } = request;
    const result = await chrome.storage.local.get(movieId);
    sendResponse({ data: result[movieId] });
  }
});
```

### 4.4 Alarms Instead of Timers

Service workers cancel setTimeout/setInterval, use alarms API instead:

```javascript
// BAD: Timer cancelled on unload
chrome.runtime.onInstalled.addListener(() => {
  setInterval(() => {
    // This won't run reliably
    syncMovieData();
  }, 60000);
});

// GOOD: Use chrome.alarms API
chrome.runtime.onInstalled.addListener(() => {
  // Create alarm that fires every 60 seconds (minimum 30 seconds in Chrome 120+)
  chrome.alarms.create('sync-movies', { periodInMinutes: 1 });
});

// Listen for alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'sync-movies') {
    syncMovieData();
  }
});

async function syncMovieData() {
  try {
    const response = await fetch('https://api.omdbapi.com/movies');
    const data = await response.json();
    await chrome.storage.local.set({ cachedMovies: data });
  } catch (error) {
    console.error('Sync failed:', error);
  }
}
```

### 4.5 Event Listener Registration (Best Practices)

```javascript
// service-worker.js - CORRECT PATTERN

// 1. Top-level event listeners (registered synchronously)
console.log('Service worker starting...');

chrome.runtime.onInstalled.addListener(handleInstall);
chrome.runtime.onMessage.addListener(handleMessage);
chrome.action.onClicked.addListener(handleActionClick);
chrome.alarms.onAlarm.addListener(handleAlarm);

// 2. Event handler functions (can be async)
async function handleInstall(details) {
  console.log('Installation details:', details);

  if (details.reason === 'install') {
    // One-time setup
    await chrome.storage.local.set({
      version: chrome.runtime.getManifest().version,
      installed: new Date().toISOString()
    });
  }
}

async function handleMessage(request, sender, sendResponse) {
  console.log('Message from', sender.url, ':', request);

  try {
    let result;

    switch(request.type) {
      case 'FETCH_MOVIE':
        result = await fetchMovieData(request.movieTitle);
        break;
      case 'GET_CACHE':
        result = await chrome.storage.local.get(request.key);
        break;
      default:
        result = { error: 'Unknown request type' };
    }

    sendResponse(result);
  } catch (error) {
    console.error('Error handling message:', error);
    sendResponse({ error: error.message });
  }

  // Important: Return true if using async/await above
  return true;
}

function handleActionClick(tab) {
  console.log('Action clicked on tab:', tab.id);

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      console.log('Injected script running');
    }
  });
}

function handleAlarm(alarm) {
  console.log('Alarm triggered:', alarm.name);

  if (alarm.name === 'sync-movies') {
    syncMovieData();
  }
}

// 3. Helper functions
async function fetchMovieData(movieTitle) {
  const apiKey = process.env.OMDB_API_KEY;
  const response = await fetch(
    `https://www.omdbapi.com/?t=${encodeURIComponent(movieTitle)}&apikey=${apiKey}`
  );

  if (!response.ok) {
    throw new Error(`API returned ${response.status}`);
  }

  return await response.json();
}

async function syncMovieData() {
  // Long-running task
  const movies = [];
  const response = await fetch('https://api.example.com/trending-movies');
  const data = await response.json();
  await chrome.storage.local.set({ cachedMovies: data });
}
```

---

## Part 5: Content Security Policy (CSP)

### 5.1 Default CSP

If not specified, this applies automatically:

```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self';",
    "sandbox": "sandbox allow-scripts allow-forms allow-popups allow-modals; script-src 'self' 'unsafe-inline' 'unsafe-eval'; child-src 'self';"
  }
}
```

### 5.2 Minimum CSP Requirements (Enforced by Chrome)

For extension pages (popup, options, service worker):

```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';"
  }
}
```

**Cannot be relaxed to:**
- Add `'unsafe-eval'` to `script-src`
- Add inline script sources
- Allow remote scripts
- Load from CDNs without via web-accessible-resources

### 5.3 Proper CSP Configuration

**popup.html (uses service worker for logic):**
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial; }
    .movie-info { padding: 10px; }
  </style>
</head>
<body>
  <div id="movie-info" class="movie-info"></div>
  <button id="search-btn">Search on Netflix</button>

  <script src="popup.js"></script>
</body>
</html>
```

**popup.js (no inline scripts):**
```javascript
// popup.js
document.getElementById('search-btn').addEventListener('click', async () => {
  const movieTitle = prompt('Enter movie title:');
  if (!movieTitle) return;

  // Send message to service worker for API call
  const response = await chrome.runtime.sendMessage({
    type: 'FETCH_MOVIE',
    movieTitle: movieTitle
  });

  document.getElementById('movie-info').innerHTML =
    `<pre>${JSON.stringify(response, null, 2)}</pre>`;
});
```

### 5.4 Loading External Resources

Never directly load from CDNs. Instead:

```html
<!-- BAD: Will not work -->
<script src="https://cdn.example.com/library.js"></script>

<!-- GOOD: Copy to extension and load locally -->
<script src="lib/library.js"></script>
```

If you must use external resources:

```json
{
  "web_accessible_resources": [
    {
      "resources": ["lib/*"],
      "matches": ["https://www.netflix.com/*"]
    }
  ]
}
```

### 5.5 Handling Third-Party Libraries

**Option 1: Bundle locally**
Copy npm packages into your extension during build.

**Option 2: Build a service worker module**
```javascript
// service-worker.js
import { someFunction } from './lib/bundled-library.js';
```

**Option 3: Use import maps (modern)**
Not recommended for extensions due to CSP restrictions.

---

## Part 6: Making External API Calls (OMDb API)

### 6.1 API Calls from Service Worker (Recommended)

Service workers have full fetch capability:

**service-worker.js:**
```javascript
const OMDB_API_KEY = process.env.OMDB_API_KEY;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'FETCH_MOVIE_DATA') {
    // Only service worker can safely make external API calls
    fetchMovieFromOMDb(request.title)
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));

    return true;  // Keep channel open for async response
  }
});

async function fetchMovieFromOMDb(movieTitle) {
  const url = new URL('https://www.omdbapi.com/');
  url.searchParams.set('t', movieTitle);
  url.searchParams.set('type', 'movie');
  url.searchParams.set('apikey', OMDB_API_KEY);

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`OMDb API error: ${response.statusText}`);
  }

  const data = await response.json();

  if (data.Response === 'False') {
    throw new Error(data.Error || 'Movie not found');
  }

  return {
    title: data.Title,
    year: data.Year,
    imdbId: data.imdbID,
    poster: data.Poster,
    plot: data.Plot,
    rating: data.imdbRating,
    genre: data.Genre,
    director: data.Director
  };
}
```

**content-script.js (sends request to service worker):**
```javascript
// Extract movie title from Netflix page
const movieTitle = document.querySelector('[data-test-id="hero-title"]')?.textContent || '';

if (movieTitle) {
  chrome.runtime.sendMessage(
    { type: 'FETCH_MOVIE_DATA', title: movieTitle },
    (response) => {
      if (response.success) {
        console.log('Movie data:', response.data);
        displayMovieInfo(response.data);
      } else {
        console.error('Failed to fetch movie data:', response.error);
      }
    }
  );
}

function displayMovieInfo(data) {
  const infoDiv = document.createElement('div');
  infoDiv.className = 'netflix-movie-info';
  infoDiv.innerHTML = `
    <h3>${data.title}</h3>
    <p>IMDb Rating: ${data.rating}/10</p>
    <p>Director: ${data.director}</p>
    <p>Plot: ${data.plot}</p>
  `;
  document.body.appendChild(infoDiv);
}
```

### 6.2 API Key Management

**Best Practice: Use environment variables**

**.env file (NOT committed to git):**
```
OMDB_API_KEY=your_actual_api_key_here
TMDB_API_KEY=your_tmdb_key_here
```

**.gitignore:**
```
.env
.env.local
node_modules/
dist/
```

**Build time injection:**
During build process, inject keys into service worker.

**Runtime storage (development only):**
```javascript
// popup.html - Development API key setup
<input type="password" id="api-key" placeholder="Enter OMDb API key">
<button id="save-key">Save Key</button>

// popup.js
document.getElementById('save-key').addEventListener('click', async () => {
  const apiKey = document.getElementById('api-key').value;
  await chrome.storage.sync.set({ omdbApiKey: apiKey });
  console.log('API key saved securely');
});
```

### 6.3 API Call Error Handling

```javascript
async function fetchMovieWithRetry(title, maxRetries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt} to fetch movie: ${title}`);
      return await fetchMovieFromOMDb(title);
    } catch (error) {
      lastError = error;
      console.warn(`Attempt ${attempt} failed:`, error);

      // Exponential backoff
      const delay = Math.pow(2, attempt - 1) * 1000;
      await sleep(delay);
    }
  }

  throw new Error(`Failed after ${maxRetries} attempts: ${lastError.message}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

---

## Part 7: Security Best Practices

### 7.1 Principle of Least Privilege

```json
{
  "manifest_version": 3,
  "name": "Netflix Extension",
  "version": "1.0.0",
  "permissions": ["storage", "scripting"],
  "host_permissions": [
    "https://www.netflix.com/*",
    "https://www.omdbapi.com/*"
  ],
  "action": {
    "default_title": "Get Netflix info"
  }
}
```

**Not:**
```json
{
  "permissions": ["<all_urls>", "storage", "tabs", "webRequest"],
  "host_permissions": ["<all_urls>"]
}
```

### 7.2 Data Privacy and Protection

**Secure API calls:**
```javascript
// ALWAYS use HTTPS
const response = await fetch('https://www.omdbapi.com/', {
  headers: {
    'X-API-Key': apiKey  // Don't expose in URL if possible
  }
});

// Hash sensitive user data
async function hashMovieTitle(title) {
  const encoder = new TextEncoder();
  const data = encoder.encode(title);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);

  // Convert to hex string
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
```

**Privacy disclosure:**
Include clear privacy policy explaining:
- What data is collected (movie titles, ratings viewed)
- How data is stored (chrome.storage.local, never transmitted)
- Third-party API calls (OMDb API privacy policy)
- Data retention policy

### 7.3 XSS Prevention

```javascript
// BAD: HTML injection vulnerability
document.getElementById('movie-info').innerHTML =
  `<h2>${movieTitle}</h2>`;  // If movieTitle has HTML, it executes

// GOOD: Use text content or DOMPurify
document.getElementById('movie-info').textContent = movieTitle;

// Or use template literals safely
const titleElement = document.createElement('h2');
titleElement.textContent = movieTitle;
document.getElementById('movie-info').appendChild(titleElement);

// Or use a sanitization library
import DOMPurify from 'dompurify';
document.getElementById('movie-info').innerHTML =
  DOMPurify.sanitize(`<h2>${movieTitle}</h2>`);
```

### 7.4 Message Validation

```javascript
// service-worker.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Always validate sender
  if (sender.url && !sender.url.includes('netflix.com')) {
    console.warn('Message from untrusted source:', sender.url);
    sendResponse({ error: 'Untrusted sender' });
    return;
  }

  // Validate request structure
  if (!request.type || typeof request.type !== 'string') {
    sendResponse({ error: 'Invalid request format' });
    return;
  }

  // Type-safe handling
  switch(request.type) {
    case 'FETCH_MOVIE':
      if (typeof request.title !== 'string') {
        sendResponse({ error: 'Invalid title' });
        return;
      }
      handleFetchMovie(request.title)
        .then(data => sendResponse({ success: true, data }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;

    default:
      sendResponse({ error: 'Unknown request type' });
  }
});
```

---

## Part 8: Modern Chrome Extension Project Structure

### 8.1 Recommended Directory Layout

```
netflix-extension/
├── src/
│   ├── service-worker.js          # Background service worker
│   ├── content-script.js           # Injected into Netflix pages
│   ├── popup.js                    # Popup script
│   ├── popup.html                  # Popup UI
│   ├── options.js                  # Options page
│   ├── options.html                # Options page UI
│   ├── styles/
│   │   ├── popup.css
│   │   ├── options.css
│   │   └── common.css
│   ├── lib/                        # Third-party libraries (bundled locally)
│   │   ├── dompurify.js
│   │   └── other-libs.js
│   └── utils/                      # Shared utilities
│       ├── api-client.js
│       └── storage.js
├── images/
│   ├── icon-16.png
│   ├── icon-48.png
│   ├── icon-128.png
│   └── logo.png
├── manifest.json                   # Extension manifest
├── .env                            # Environment variables (NOT in git)
├── .env.example                    # Template for .env
├── .gitignore
├── package.json
├── webpack.config.js               # Bundler config (if using)
├── README.md
└── tests/
    ├── service-worker.test.js
    ├── content-script.test.js
    └── api-client.test.js
```

### 8.2 Minimal Working Example

**manifest.json:**
```json
{
  "manifest_version": 3,
  "name": "Netflix Info",
  "version": "1.0.0",
  "description": "View movie ratings and details",
  "icons": {
    "16": "images/icon-16.png",
    "48": "images/icon-48.png",
    "128": "images/icon-128.png"
  },
  "permissions": ["storage", "scripting"],
  "host_permissions": [
    "https://www.netflix.com/*",
    "https://www.omdbapi.com/*"
  ],
  "background": {
    "service_worker": "src/service-worker.js"
  },
  "content_scripts": [
    {
      "matches": ["https://www.netflix.com/*"],
      "js": ["src/content-script.js"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_title": "View movie details",
    "default_popup": "src/popup.html",
    "default_icon": "images/icon-48.png"
  }
}
```

**src/service-worker.js:**
```javascript
console.log('Service worker loaded');

chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed:', details.reason);
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'FETCH_MOVIE') {
    fetchMovieData(request.title)
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

async function fetchMovieData(movieTitle) {
  const apiKey = (await chrome.storage.sync.get('omdbApiKey')).omdbApiKey;
  if (!apiKey) throw new Error('API key not configured');

  const response = await fetch(
    `https://www.omdbapi.com/?t=${encodeURIComponent(movieTitle)}&apikey=${apiKey}`
  );
  const data = await response.json();

  if (data.Response === 'False') {
    throw new Error(data.Error);
  }

  return data;
}
```

**src/content-script.js:**
```javascript
console.log('Content script loaded on Netflix');

// Wait for page to load and extract title
function extractMovieTitle() {
  const titleElement = document.querySelector('[class*="title"]');
  return titleElement?.textContent?.trim() || null;
}

window.addEventListener('load', () => {
  const title = extractMovieTitle();
  if (title) {
    chrome.runtime.sendMessage(
      { type: 'FETCH_MOVIE', title: title },
      (response) => {
        if (response.success) {
          console.log('Movie data received:', response.data);
        }
      }
    );
  }
});
```

**src/popup.html:**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="styles/popup.css">
</head>
<body>
  <div id="movie-info">
    <p>Loading...</p>
  </div>
  <script src="popup.js"></script>
</body>
</html>
```

**src/popup.js:**
```javascript
// Display info from current tab when popup opens
chrome.tabs.query({ active: true }, (tabs) => {
  const tab = tabs[0];

  if (!tab.url.includes('netflix.com')) {
    document.getElementById('movie-info').innerHTML =
      '<p>Please navigate to Netflix</p>';
    return;
  }

  chrome.runtime.sendMessage(
    { type: 'FETCH_MOVIE', title: 'Inception' },
    (response) => {
      const infoDiv = document.getElementById('movie-info');
      if (response.success) {
        infoDiv.innerHTML = `
          <h3>${response.data.Title}</h3>
          <p>Rating: ${response.data.imdbRating}</p>
          <p>Year: ${response.data.Year}</p>
        `;
      } else {
        infoDiv.innerHTML = `<p>Error: ${response.error}</p>`;
      }
    }
  );
});
```

**src/styles/popup.css:**
```css
body {
  width: 300px;
  font-family: Arial, sans-serif;
  padding: 10px;
  background-color: #f5f5f5;
}

h3 {
  margin: 0 0 10px 0;
  color: #e50914;  /* Netflix red */
}

p {
  margin: 5px 0;
  color: #333;
}
```

### 8.3 Testing with Chrome DevTools

**In chrome://extensions (Developer mode):**

1. Click "Load unpacked"
2. Select your project directory
3. View logs:
   - Service worker: Click "Inspect" under "Service Worker"
   - Content script: Open Netflix page, right-click > "Inspect"
   - Popup: Open popup, right-click > "Inspect"

---

## Part 9: Common Issues and Solutions

### 9.1 Service Worker Keeps Unloading

**Problem:** Long-running operations fail

**Solution:**
```javascript
// Track async operations properly
async function longRunningTask() {
  const startTime = Date.now();

  try {
    // Your work here
    const result = await fetch('/some/api');
    return result;
  } finally {
    console.log(`Task completed in ${Date.now() - startTime}ms`);
  }
}

// For background syncing: use alarms
chrome.alarms.create('long-task', { periodInMinutes: 5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'long-task') {
    longRunningTask();
  }
});
```

### 9.2 Content Script Cannot Access Page Variables

**Problem:** Need to access Netflix's internal JavaScript

**Solution: Use MAIN world execution**

```json
{
  "content_scripts": [
    {
      "matches": ["https://www.netflix.com/*"],
      "js": ["src/main-world-script.js"],
      "world": "MAIN"
    }
  ]
}
```

**main-world-script.js:**
```javascript
// This can access window object and page variables
console.log(window.userProfile);  // Netflix's internal object
```

**Warning:** Be careful with MAIN world - page scripts can access your code too.

### 9.3 API Key Exposed in Extension Code

**Problem:** API key visible to users

**Solution:**
```javascript
// Use environment variables during build
// service-worker.js
const API_KEY = '__OMDB_API_KEY__';  // Replaced during build

// Build process replaces __OMDB_API_KEY__ with actual key
// See webpack.config.js example below
```

**webpack.config.js:**
```javascript
const webpack = require('webpack');
require('dotenv').config();

module.exports = {
  entry: './src/service-worker.js',
  output: { filename: 'service-worker.js' },
  plugins: [
    new webpack.DefinePlugin({
      '__OMDB_API_KEY__': JSON.stringify(process.env.OMDB_API_KEY)
    })
  ]
};
```

### 9.4 Content Security Policy Errors

**Problem:** "Refused to load the script because it violates the Content Security Policy"

**Solution:**
- Never use inline scripts: `<script>console.log('hi')</script>`
- Load all scripts from files: `<script src="popup.js"></script>`
- Load third-party libraries locally, not from CDN
- Use `web_accessible_resources` for resources accessed from web pages

### 9.5 Permission Warnings Causing Installation Failures

**Problem:** New permissions added, users must re-approve extension

**Solution:**
```json
{
  "permissions": ["storage"],
  "optional_permissions": ["tabs"],
  "optional_host_permissions": ["https://*.netflix.com/*"]
}
```

Request permissions when feature is enabled, not at install time.

---

## Part 10: June 2025 Timeline and Migration Notes

### 10.1 Manifest V2 End of Support

**Status:** Manifest V2 has been completely removed from Chrome Web Store as of June 2025.

**Action Required:**
- All new extensions must use Manifest V3
- Migration from V2 to V3 is mandatory
- Use Chrome's Extension Manifest Converter as starting point
- GitHub: `GoogleChromeLabs/extension-manifest-converter`

### 10.2 Recent Chrome Improvements (2024-2025)

**Chrome 133+:**
- Enhanced host access request APIs
- Better control over temporary permissions

**Chrome 120:**
- Alarms minimum period: 30 seconds (matches service worker lifecycle)

**Chrome 118:**
- Debugger API keeps service workers alive

**Chrome 116:**
- WebSocket connections extend service worker lifetime
- Improved service worker lifecycle management
- `chrome.runtime.getContexts()` for context introspection

### 10.3 Service Worker Reliability Improvements

Since Chrome 109-116, significant improvements have been made:
- Messages from offscreen documents keep service worker alive
- WebSocket activity resets idle timer
- Long-lived connections properly tracked
- Better handling of asynchronous API calls

---

## Part 11: Performance Considerations

### 11.1 Service Worker Performance

Keep service workers lean and responsive:

```javascript
// GOOD: Fast event handlers
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Respond quickly
  if (request.type === 'QUICK_CHECK') {
    sendResponse({ cached: true });
    return;  // Don't keep connection open unnecessarily
  }

  // Async work
  if (request.type === 'ASYNC_WORK') {
    asyncOperation()
      .then(result => sendResponse({ data: result }))
      .catch(err => sendResponse({ error: err.message }));
    return true;  // Keep connection open
  }
});

// BAD: Long synchronous operations
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  let result = 0;
  for (let i = 0; i < 1000000000; i++) {
    result += Math.random();
  }
  sendResponse({ result });  // Blocks service worker for too long
});
```

### 11.2 Content Script Performance

Minimize DOM manipulation overhead:

```javascript
// BAD: Multiple DOM queries
for (let i = 0; i < movies.length; i++) {
  document.querySelector('#movie-list').appendChild(
    createMovieElement(movies[i])
  );  // Forces layout recalculation each iteration
}

// GOOD: Batch DOM updates
const movieList = document.querySelector('#movie-list');
const fragment = document.createDocumentFragment();

for (let i = 0; i < movies.length; i++) {
  fragment.appendChild(createMovieElement(movies[i]));
}

movieList.appendChild(fragment);  // Single layout recalculation
```

### 11.3 Storage Performance

```javascript
// BAD: Multiple individual storage calls
for (const movie of movies) {
  await chrome.storage.local.set({ [movie.id]: movie });
}

// GOOD: Batch into single call
const batch = {};
for (const movie of movies) {
  batch[movie.id] = movie;
}
await chrome.storage.local.set(batch);
```

---

## Part 12: Debugging and Testing

### 12.1 Logging Strategy

```javascript
// service-worker.js
const LOG_LEVEL = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

const CURRENT_LEVEL = LOG_LEVEL.DEBUG;

function log(level, message, data = null) {
  if (level <= CURRENT_LEVEL) {
    const prefix = Object.keys(LOG_LEVEL).find(k => LOG_LEVEL[k] === level);
    if (data) {
      console.log(`[${prefix}] ${message}`, data);
    } else {
      console.log(`[${prefix}] ${message}`);
    }
  }
}

// Usage
log(LOG_LEVEL.INFO, 'Service worker initialized');
log(LOG_LEVEL.DEBUG, 'Message received', { type: 'FETCH_MOVIE', title: 'Inception' });
log(LOG_LEVEL.ERROR, 'API call failed', new Error('Network error'));
```

### 12.2 Testing Content Scripts

```javascript
// tests/content-script.test.js
describe('Content Script', () => {
  beforeEach(() => {
    // Mock DOM
    document.body.innerHTML = `
      <div class="movie-title">Inception</div>
    `;
  });

  it('should extract movie title', () => {
    // Include content script logic
    const title = document.querySelector('.movie-title')?.textContent;
    expect(title).toBe('Inception');
  });
});
```

### 12.3 Monitoring Service Worker Lifetime

```javascript
// service-worker.js
let isActive = true;

// Track service worker activation
console.log('Service worker activated');

// Monitor for unload
window.addEventListener('beforeunload', () => {
  isActive = false;
  console.warn('Service worker is unloading');
});

// Periodic heartbeat
setInterval(() => {
  if (isActive) {
    console.log('Service worker is alive', new Date().toISOString());
  }
}, 30000);
```

---

## Key Takeaways and Best Practices Summary

1. **Manifest V3 is Mandatory** - All extensions must use MV3. V2 support ended June 2025.

2. **Service Workers Are Stateless** - Use `chrome.storage` instead of global variables.

3. **Register Listeners Synchronously** - Put all event listeners at top level of service worker.

4. **Use Alarms Instead of Timers** - `setTimeout` and `setInterval` don't work reliably.

5. **Minimize Host Permissions** - Use `activeTab` when possible instead of persistent permissions.

6. **Separate API Keys** - Never hardcode API keys; use environment variables or storage.

7. **Message-Based Architecture** - Content scripts and service workers communicate via `chrome.runtime.sendMessage`.

8. **Content Security Policy** - No inline scripts, no remote code, strict CSP enforcement.

9. **Data Storage** - Persist all important data to `chrome.storage` to survive service worker unloads.

10. **Testing and Debugging** - Use chrome://extensions with Developer Mode for inspection.

---

## Source References

### Official Chrome Documentation
- [Manifest V3 Specification](https://developer.chrome.com/docs/extensions/reference/manifest/)
- [Content Scripts Documentation](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts/)
- [Service Workers Guide](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/)
- [Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
- [Messaging API](https://developer.chrome.com/docs/extensions/develop/concepts/messaging/)
- [Permissions Reference](https://developer.chrome.com/docs/extensions/reference/permissions/)
- [Content Security Policy](https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy/)
- [Web Accessible Resources](https://developer.chrome.com/docs/extensions/reference/manifest/web-accessible-resources/)
- [activeTab Permission](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab/)
- [Offscreen Documents API](https://developer.chrome.com/docs/extensions/reference/api/offscreen/)
- [Match Patterns](https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns/)

### Community Resources
- [Chrome Extensions Samples Repository](https://github.com/GoogleChrome/chrome-extensions-samples)
- [Extension Manifest Converter](https://github.com/GoogleChromeLabs/extension-manifest-converter)
- Stack Overflow discussions on MV3 migration and implementation
- Chrome DevTools documentation for extension debugging

### Migration Guidance
- [Migrate to Manifest V3](https://developer.chrome.com/docs/extensions/develop/migrate)
- [June 2025 MV2 Removal Announcement](https://developer.chrome.com/blog/resuming-the-transition-to-mv3)

---

## Document Information

- **Last Updated:** November 19, 2025
- **Chrome Version Compatibility:** Chrome 88+
- **MV3 Status:** Current and required
- **Research Depth:** Comprehensive
- **Practical Examples:** Included throughout

This document provides implementation-ready guidance for building modern Chrome extensions with Manifest V3.
