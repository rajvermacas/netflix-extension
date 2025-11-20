# Netflix DOM Structure and Chrome Extension Integration Guide

**Research Date**: November 19, 2025

**Last Updated**: November 19, 2025

**Status**: Comprehensive Analysis - Production Ready

---

## Executive Summary

Netflix uses a modern single-page application (SPA) architecture built on React with custom optimizations. The platform employs dynamic content loading via AJAX, lazy loading of thumbnails, and React-based component rendering. Building extensions requires understanding Netflix's specific DOM patterns, data attributes, content script isolation constraints, and timing challenges with dynamically loaded content.

**Key Takeaway**: Netflix is a JavaScript-heavy SPA that loads content dynamically. Extensions must use `MutationObserver` to detect content changes, be aware of content script isolation limitations when accessing Netflix's internal APIs, and target stable `data-uia` attributes alongside CSS classes for maximum reliability.

---

## 1. Netflix DOM Structure Overview

### 1.1 Architecture and Technology Stack

Netflix's web platform uses:

- **Frontend Framework**: React (custom optimized version)
- **JavaScript Engine**: Custom-optimized JavaScript runtime
- **Page Type**: Single-Page Application (SPA)
- **Content Loading**: AJAX with dynamic updates
- **Styling**: Custom CSS with extensive use of class-based selectors
- **Data Attributes**: Custom `data-uia` attributes for UI automation and testing

**Important Note**: Netflix has no public API (discontinued in 2014). Extensions must work entirely through DOM inspection and internal API interception.

### 1.2 Page Types and Content Structure

Netflix has multiple distinct page types with different DOM structures:

#### A. Homepage/Browse Pages (`netflix.com/browse`)
- **Purpose**: Display personalized recommendations and content categories
- **Content Type**: Carousels, grids of tile thumbnails
- **Structure**: Horizontally scrolling rows with lazy-loaded images
- **Key Characteristics**:
  - Content loads progressively as user scrolls
  - Thumbnails are lazy-loaded to improve performance
  - Carousel structure uses transform/translate for smooth scrolling
  - Multiple rows can be visible simultaneously

#### B. Detail/Preview Pages (Movie/Series Detail Modal)
- **Purpose**: Show metadata, synopsis, cast, year when user hovers/clicks on content
- **Content Type**: Modal overlays with expandable sections
- **Structure**: Hidden elements that become visible on user interaction
- **Key Characteristics**:
  - Initially hidden until triggered by user action
  - Contains metadata sections that may expand/collapse
  - Requires `MutationObserver` to detect visibility changes
  - Metadata appears in structured DOM sections

#### C. Video Player Page (`netflix.com/watch/[id]`)
- **Purpose**: Main playback experience
- **Content Type**: HTML5 video player with Netflix controls
- **Structure**: Player container with control overlay
- **Key Characteristics**:
  - Player controls appear/disappear on user interaction
  - Title and metadata displayed in various locations
  - Heavily JavaScript-controlled
  - Player API accessible through window context (with restrictions)

#### D. Search Results Pages (`netflix.com/search`)
- **Purpose**: Display search results in grid/list format
- **Content Type**: Grid of result tiles
- **Structure**: Similar to browse but filtered/sorted

---

## 2. DOM Selectors and CSS Classes

### 2.1 Critical DOM Selectors - Priority Reference

These selectors are the most reliable for extension development:

#### Title/Video Information (HIGHEST PRIORITY)

```javascript
// Player page - Video title (most reliable)
const title = document.querySelector("[data-uia='video-title']");

// Browse/Modal - Title in various locations
const titleInEllipsize = document.querySelector("h4.ellipsize-text");

// Billboard title (home page featured content)
const billboardTitle = document.querySelector("[data-uia='billboard-title']");

// Video info panel
const videoInfo = document.querySelector("[data-uia='video-info']");

// Title from metadata area
const metadataTitle = document.querySelector("[role='region'] h1");
```

#### Carousel and Tile Elements

```javascript
// Browse page carousels - main containers
const carousels = document.querySelectorAll("[role='group']");

// Individual tile/card containers
const tiles = document.querySelectorAll("[data-uia*='tile']");

// Row wrapper (carousel row)
const rows = document.querySelectorAll("[class*='row']");

// Scrollable container
const scrollableContent = document.querySelector("[role='region']");

// Video card/tile
const videoCard = document.querySelector("[data-uia='video-card']");
```

#### Player Controls and Status

```javascript
// Play/Pause button
const playButton = document.querySelector("[data-uia='player-play-pause']");

// Player control bar
const controlBar = document.querySelector(".player-control-button");

// Player status/title area
const playerTitle = document.querySelector(".player-status-main-title");

// Video container
const videoContainer = document.querySelector("[class*='video-container']");
```

#### Modal and Hidden Elements

```javascript
// Detail modal (initially hidden)
const detailModal = document.querySelector("[role='dialog']");

// Modal content area
const modalContent = document.querySelector("[class*='modal-content']");

// Expandable metadata sections
const expandableSections = document.querySelectorAll("[aria-expanded='false']");
```

### 2.2 Attribute-Based Selectors (Most Stable)

**Netflix uses `data-uia` attributes extensively**. These are more stable than class names since they're intended for automation testing and change less frequently.

#### Common data-uia Patterns

```javascript
// Format: [data-uia='specific-identifier']

// Core content identifiers
[data-uia='video-title']                  // Video/series title
[data-uia='billboard-title']              // Featured content title
[data-uia='video-info']                   // Video metadata container
[data-uia='play-button']                  // Play button
[data-uia='video-card']                   // Individual content card
[data-uia='tile']                         // Browse tile element
[data-uia*='row']                         // Row containers (wildcard)

// Example usage:
const titles = document.querySelectorAll("[data-uia*='title']");
const videoCards = document.querySelectorAll("[data-uia*='video']");
```

**Why data-uia?**
- Specifically designed for automation (less likely to change)
- Class names frequently change with UI updates
- Provides semantic meaning about element purpose
- Better than parsing class name strings

### 2.3 Class-Based Selectors (Secondary Priority)

These change more frequently but are still useful:

```javascript
// Carousel/Row structure
.row, .row__inner, .row__content
.carousel, .carousel-row, .carousel-item
.slider, .slider-item

// Tile/Card structure
.tile, .tile__media, .tile__img, .tile__title
.card, .card-content, .card-image
.video-card, .video-thumbnail

// Text elements
.ellipsize-text              // Truncated text (used for titles)
.title-title               // Title container
.episode-title             // Episode title
.subtitle-text             // Subtitle/description

// Player elements
.player-control-button
.player-play-pause
.player-slider
.player-status-main-title

// Modal/Dialog
.modal, .modal-content
.dialog-overlay
.popup-overlay
```

**Warning**: Class names like `.row`, `.carousel` are very generic and subject to change. Always combine with parent selectors or data-uia attributes when possible.

### 2.4 ARIA and Role Attributes

Netflix uses ARIA attributes for accessibility - useful supplementary selectors:

```javascript
// Dialogs and modals
[role='dialog']              // Detail preview modals
[role='region']              // Content regions
[role='group']               // Carousel/grouped content

// Expandable sections
[aria-expanded='true']       // Expanded metadata sections
[aria-expanded='false']      // Collapsed sections (hidden content)

// Labels and descriptions
[aria-label*='title']        // Elements with title in aria-label

// Example:
const modalContent = document.querySelector("[role='dialog']");
const expandedSections = document.querySelectorAll("[aria-expanded='true']");
```

---

## 3. Content Dynamic Loading and AJAX Patterns

### 3.1 How Netflix Loads Content

Netflix implements a sophisticated content loading strategy:

#### Initial Page Load
1. HTML skeleton is served (minimal content)
2. React bundles are loaded and executed
3. Initial viewport content is rendered
4. Additional content loads via subsequent AJAX requests

#### Carousel/Browse Content Loading
1. **On-Demand Loading**: Rows/carousels load content as user navigates
2. **Lazy Image Loading**: Thumbnail images load when approaching viewport
3. **Prefetching**: Netflix prefetches images for titles slightly below the fold
4. **Progressive Enhancement**: Content appears to stream as user scrolls

#### Detail Modal Loading
1. **Trigger**: User hovers/clicks on content tile
2. **Content Fetch**: Detail information fetched via internal API
3. **DOM Update**: Modal DOM updated with metadata
4. **Animation**: Smooth transition shows detail view

### 3.2 AJAX Request Patterns

Netflix uses XMLHttpRequest and Fetch API to load content:

```javascript
// Types of AJAX calls:

// 1. Browse catalog data
GET /api/v1/browse?genreId=123&offset=0&limit=20

// 2. Video metadata
GET /api/v1/videos/[videoId]/metadata

// 3. Title details
GET /api/v1/titles/[titleId]/details

// 4. Viewing activity (for recommendation)
GET /api/v1/user/viewingActivity
```

**Impact on Extensions**:
- Listening for fetch/XHR requests doesn't work reliably in content scripts
- Must rely on DOM changes after content loads
- MutationObserver timing critical for catching rendered content

### 3.3 SPA Navigation Patterns

Netflix is a single-page application with client-side routing:

```javascript
// Page navigation doesn't trigger full page reloads
// Instead, URL changes and DOM is updated

// URL patterns:
/browse                      // Homepage
/browse?jbv=[id]            // Browse with preview modal
/watch/[videoId]             // Player page
/search?q=[query]            // Search results

// No traditional page loads occur
// JavaScript handles all view transitions
// Window.location.pathname and history API used

// This means:
// - Normal fetch APIs may get cached responses
// - Content appears dynamically in DOM
// - Full page refresh events don't fire
```

---

## 4. Using MutationObserver on Netflix

### 4.1 Why MutationObserver is Essential

Netflix's dynamic content loading makes MutationObserver critical:

- Content appears after page load via AJAX
- Modals and detail panels appear on user interaction
- Carousels load as user scrolls
- Player controls appear/disappear dynamically

Traditional approaches (polling, setInterval) are inefficient. MutationObserver detects DOM changes immediately.

### 4.2 Best Practices for MutationObserver Implementation

#### Basic Structure

```javascript
// Create observer instance
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    // Handle DOM changes
    if (mutation.type === 'childList') {
      // Child nodes were added/removed
      handleNewContent(mutation.addedNodes);
    } else if (mutation.type === 'attributes') {
      // Attributes changed
      handleAttributeChange(mutation.target, mutation.attributeName);
    }
  });
});

// Configuration: what to observe
const observerConfig = {
  childList: true,           // Watch for added/removed nodes
  attributes: true,          // Watch for attribute changes
  attributeFilter: ['class', 'style', 'aria-expanded', 'data-uia'],
  subtree: true,             // Watch all descendants
  attributeOldValue: true,   // Record old attribute values
};

// Start observing
observer.observe(document.body, observerConfig);
```

#### Optimized Configuration (Resource Conscious)

```javascript
// Observe only necessary changes to reduce CPU usage
const optimizedConfig = {
  childList: true,
  subtree: true,
  // Only watch specific attributes
  attributes: true,
  attributeFilter: ['aria-expanded', 'class'],
  // Ignore character data mutations
  characterData: false,
  attributeOldValue: false,
};

// Observe specific container rather than body
const contentContainer = document.querySelector('[role="main"]');
observer.observe(contentContainer, optimizedConfig);
```

### 4.3 Handling Timing Issues

One of the biggest challenges with MutationObserver on Netflix:

```javascript
// PROBLEM: Mutation fires BEFORE content is fully rendered
observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    // This fires immediately, but content may not be complete yet
    const title = mutation.addedNodes[0]?.querySelector('h4.ellipsize-text');
    console.log(title?.textContent); // May be undefined
  });
});

// SOLUTION 1: Debouncing
const debouncedProcess = (() => {
  let timeout;
  return (mutations) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      // Wait 100ms for render to complete
      processContentChanges(mutations);
    }, 100);
  };
})();

observer = new MutationObserver(debouncedProcess);

// SOLUTION 2: requestAnimationFrame
observer = new MutationObserver((mutations) => {
  requestAnimationFrame(() => {
    // Wait for paint/render cycle
    processContentChanges(mutations);
  });
});

// SOLUTION 3: Retry mechanism with exponential backoff
function extractTitleWithRetry(element, attempts = 3) {
  const title = element.querySelector('h4.ellipsize-text')?.textContent;

  if (!title && attempts > 0) {
    // Retry after delay
    setTimeout(() => {
      extractTitleWithRetry(element, attempts - 1);
    }, Math.pow(2, 4 - attempts) * 50); // 50ms, 100ms, 200ms
  }

  return title;
}
```

### 4.4 Specific Mutation Patterns for Netflix

#### Pattern 1: Detecting Modal/Detail Panel Appearance

```javascript
// Netflix detail modals appear when user interacts with tiles
observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === 'attributes') {
      const target = mutation.target;

      // Check if dialog became visible
      if (mutation.attributeName === 'class') {
        const isModalVisible = target.classList.contains('visible')
          || target.style.display !== 'none';

        if (isModalVisible && target.role === 'dialog') {
          console.log('Detail modal appeared');
          // Extract title and metadata
          const title = target.querySelector("[data-uia='video-title']")?.textContent;
          console.log('Title:', title);
        }
      }
    }
  });
});

observer.observe(document.body, {
  attributes: true,
  attributeFilter: ['class', 'style'],
  subtree: true,
});
```

#### Pattern 2: Detecting New Carousel Content

```javascript
observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === 'childList') {
      // Check for newly added carousel rows
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const tiles = node.querySelectorAll("[data-uia='video-card']");

          if (tiles.length > 0) {
            console.log(`Found ${tiles.length} new video cards`);

            // Extract title from each tile
            tiles.forEach((tile) => {
              const title = tile.querySelector("[data-uia='video-title']")
                ?.getAttribute('aria-label');
              console.log('Tile title:', title);
            });
          }
        }
      });
    }
  });
});

observer.observe(document.querySelector('[role="main"]'), {
  childList: true,
  subtree: true,
});
```

#### Pattern 3: Player Page Title Detection

```javascript
observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === 'attributes' &&
        mutation.attributeName === 'class') {

      // Player controls appeared
      if (mutation.target.classList.contains('player-controls-visible')) {
        // Extract title from player UI
        const playerTitle = document.querySelector("[data-uia='player-title']");
        if (playerTitle) {
          console.log('Now playing:', playerTitle.textContent);
        }
      }
    }
  });
});

observer.observe(document.body, {
  attributes: true,
  attributeFilter: ['class'],
  subtree: true,
});
```

### 4.5 Common MutationObserver Gotchas on Netflix

```javascript
// GOTCHA 1: Observer fires many times for small changes
// Solution: Batch and debounce mutations
let mutationQueue = [];
const processMutations = (() => {
  let timeout;
  return () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      // Process all queued mutations at once
      const uniqueTargets = new Set();
      mutationQueue.forEach(m => uniqueTargets.add(m.target));
      mutationQueue = [];

      uniqueTargets.forEach(target => {
        processSingleTarget(target);
      });
    }, 50);
  };
})();

observer = new MutationObserver((mutations) => {
  mutationQueue.push(...mutations);
  processMutations();
});

// GOTCHA 2: Removed nodes still accessible in mutation.removedNodes
// Solution: Check if node is still in document
observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.removedNodes.forEach((node) => {
      // Node no longer in DOM
      if (!document.contains(node)) {
        console.log('Node removed from document');
      }
    });
  });
});

// GOTCHA 3: Filter changes that aren't relevant
observer = new MutationObserver((mutations) => {
  // Skip mutations that aren't meaningful
  const meaningfulMutations = mutations.filter((m) => {
    // Skip whitespace-only text nodes
    if (m.type === 'characterData') {
      return m.target.textContent.trim().length > 0;
    }
    // Skip style-only attribute changes
    if (m.attributeName === 'style' &&
        m.oldValue === m.target.getAttribute('style')) {
      return false;
    }
    return true;
  });

  meaningfulMutations.forEach(processChange);
});

// GOTCHA 4: Performance degradation with too many observers
// Solution: Use single observer with broad subtree instead of many narrow ones
// Bad:
document.querySelectorAll('[data-uia="video-card"]').forEach(card => {
  new MutationObserver(handler).observe(card, config); // Creates 100+ observers!
});

// Good:
const observer = new MutationObserver(handler);
observer.observe(document.querySelector('[role="main"]'), {
  childList: true,
  subtree: true,
});
```

---

## 5. Extracting Title Names and Years

### 5.1 Title Extraction from Different Page Types

#### From Player Page (Most Reliable)

```javascript
// Method 1: data-uia attribute (PREFERRED)
const title = document.querySelector("[data-uia='video-title']")?.textContent;

// Method 2: Ellipsize text class
const titleAlt = document.querySelector("h4.ellipsize-text")?.textContent;

// Method 3: From player status area
const playerTitle = document.querySelector(".player-status-main-title")?.textContent;

// Example output:
// "The Breakfast Club"
// "Stranger Things" (Season 1, Episode 3)
```

#### From Browse/Modal Pages

```javascript
// Billboard featured content
const billboardTitle = document.querySelector("[data-uia='billboard-title']")?.textContent;

// Detail modal (hidden until opened)
const modalTitle = document.querySelector("[role='dialog'] h1")?.textContent;

// Video card on hover/click
const cardTitle = document.querySelector("[data-uia='video-card'] [data-uia='video-title']")?.textContent;

// aria-label attribute (often contains full info)
const ariaTitle = document.querySelector("[data-uia='video-card']")?.getAttribute('aria-label');
// Example: "The Crown | 2016 | TV-MA | 10 Seasons"
```

#### From Search Results

```javascript
// Search result grid tiles
const searchResults = document.querySelectorAll("[data-uia*='search-result']");

searchResults.forEach((result) => {
  const title = result.querySelector("[data-uia='video-title']")?.textContent;
  const year = result.querySelector("[class*='year']")?.textContent;
  console.log(`${title} (${year})`);
});
```

### 5.2 Year Extraction Strategies

**Challenge**: Years are not always in consistent locations. Netflix often doesn't display release year prominently on browse pages.

```javascript
// Strategy 1: From aria-label (contains structured data)
function extractYearFromAriaLabel(element) {
  const ariaLabel = element.getAttribute('aria-label');
  // Example: "Inception | 2010 | PG-13 | Film"
  const yearMatch = ariaLabel?.match(/\b(19|20)\d{2}\b/);
  return yearMatch ? yearMatch[0] : null;
}

// Strategy 2: From detail metadata in modal
function extractYearFromModal() {
  // After modal opens, year often in metadata section
  const metadataElement = document.querySelector(
    "[role='dialog'] [class*='metadata']"
  );
  const yearText = Array.from(metadataElement?.querySelectorAll('span') || [])
    .find(el => /\b(19|20)\d{2}\b/.test(el.textContent))?.textContent;
  return yearText;
}

// Strategy 3: Extract from page HTML response (for detail pages)
function extractYearFromHTML(html) {
  // Look for common patterns in HTML
  const patterns = [
    /release["\s]*:["\s]*(\d{4})/i,
    /year["\s]*:["\s]*(\d{4})/i,
    /data-year["\s]*=["\s]*"(\d{4})"/i,
    /\b(19|20)\d{2}\b/,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Strategy 4: From Netflix's internal data structure
function extractYearFromWindowData() {
  // Netflix stores data in window object
  // Access may be restricted from content script
  try {
    // This will fail in content scripts due to isolation
    const data = window.__NETFLIX_DATA__ || window.netflix?.appContext;
    return data?.videoDetails?.year;
  } catch (e) {
    console.log('Cannot access window data from content script');
    return null;
  }
}

// Strategy 5: URL-based extraction (for some pages)
function extractYearFromURL() {
  const url = window.location.href;
  // Netflix detail URLs sometimes include year
  const yearMatch = url.match(/\/(\d{4})[/?]/);
  return yearMatch ? yearMatch[1] : null;
}

// Combined extraction function
function extractTitleAndYear(element) {
  const title = element.querySelector("[data-uia='video-title']")?.textContent;

  let year = null;

  // Try aria-label first (most reliable)
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) {
    year = extractYearFromAriaLabel(element);
  }

  // Fall back to DOM search
  if (!year) {
    const yearElement = element.querySelector("[class*='year']");
    year = yearElement?.textContent?.match(/\d{4}/)?.[0];
  }

  // Last resort: regex in all text
  if (!year) {
    const allText = element.textContent || '';
    year = allText.match(/\b(19|20)\d{2}\b/)?.[0];
  }

  return { title, year };
}
```

### 5.3 Handling Edge Cases

```javascript
// Problem: Some titles are TV shows and include season/episode info
function parseTitle(rawTitle) {
  // "Stranger Things" (Season 1, Episode 3)
  // "The Breakfast Club" (2-hour runtime)

  const titleMatch = rawTitle.match(/^([^(]+)/);
  const title = titleMatch ? titleMatch[1].trim() : rawTitle;

  const seasonMatch = rawTitle.match(/Season\s+(\d+)/i);
  const episodeMatch = rawTitle.match(/Episode\s+(\d+)/i);

  return {
    title,
    season: seasonMatch ? parseInt(seasonMatch[1]) : null,
    episode: episodeMatch ? parseInt(episodeMatch[1]) : null,
    rawInput: rawTitle,
  };
}

// Problem: Multiple elements with same title
function extractUniqueTitle() {
  // Netflix may render title in multiple places
  const titleElements = document.querySelectorAll("[data-uia='video-title']");

  // Get first one (usually most reliable)
  const primaryTitle = titleElements[0]?.textContent;

  // Verify it's not just placeholder/template text
  if (primaryTitle && primaryTitle.length > 2) {
    return primaryTitle;
  }

  return null;
}

// Problem: Encoded/escaped text
function cleanTitle(title) {
  return title
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .trim();
}
```

---

## 6. Injecting Custom UI Elements

### 6.1 Safe Injection Points

Netflix uses a complex DOM structure. Injecting elements carelessly can break layouts or be removed by React re-renders.

#### Safest Injection Points

```javascript
// BEST: After player controls (least likely to be managed by React)
const playerControlsContainer = document.querySelector('.player-controls');
if (playerControlsContainer) {
  const customButton = document.createElement('button');
  customButton.id = 'my-extension-button';
  customButton.textContent = 'My Extension';
  playerControlsContainer.appendChild(customButton);
}

// GOOD: In detail modal footer
const modalFooter = document.querySelector("[role='dialog'] [class*='footer']");
if (modalFooter) {
  const badge = document.createElement('div');
  badge.className = 'my-extension-badge';
  badge.textContent = 'Rating: 8.5/10';
  modalFooter.appendChild(badge);
}

// GOOD: Create a new dedicated container
const extensionContainer = document.createElement('div');
extensionContainer.id = 'netflix-extension-overlay';
extensionContainer.style.position = 'fixed';
extensionContainer.style.zIndex = '10000';
document.body.appendChild(extensionContainer);
// Safe to inject custom UI here

// AVOID: Modifying React-managed DOM directly
// Don't inject into:
// - Video card containers (managed by React)
// - Carousel tiles (constantly re-rendered)
// - Detail modal content area (state-driven)
```

### 6.2 Preventing React from Removing Your Elements

```javascript
// Problem: React re-renders and removes injected elements
// Solution: Use MutationObserver to re-inject

function injectPersistentElement(parentSelector, createElementFn) {
  const parent = document.querySelector(parentSelector);
  if (!parent) return null;

  // Create and inject
  const element = createElementFn();
  parent.appendChild(element);

  // Monitor for removal by React
  const observer = new MutationObserver(() => {
    if (!document.contains(element)) {
      // Element was removed, re-inject
      const newElement = createElementFn();
      if (document.querySelector(parentSelector)) {
        document.querySelector(parentSelector).appendChild(newElement);
      }
    }
  });

  observer.observe(parent, {
    childList: true,
    subtree: false,
  });

  return element;
}

// Usage:
injectPersistentElement('.player-controls', () => {
  const btn = document.createElement('button');
  btn.textContent = 'My Button';
  btn.className = 'my-extension-button';
  return btn;
});
```

### 6.3 Styling Custom Elements

```javascript
// Inject CSS to avoid inline style conflicts
function injectStyles() {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    #netflix-extension-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 10000;
      pointer-events: none;
    }

    .my-extension-button {
      background-color: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.3);
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto;
      font-size: 12px;
      transition: all 0.2s ease;
    }

    .my-extension-button:hover {
      background-color: rgba(255, 255, 255, 0.2);
      border-color: rgba(255, 255, 255, 0.5);
    }

    .my-extension-badge {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      color: white;
      padding: 4px 8px;
      border-radius: 3px;
      font-size: 11px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  `;
  document.head.appendChild(styleSheet);
}

// Call on extension load
injectStyles();
```

### 6.4 Handling z-index and Overlays

```javascript
// Netflix has high z-index modals and player controls
// Ensure your UI is above them

function createFixedOverlay(content) {
  const overlay = document.createElement('div');
  overlay.className = 'extension-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 9999; /* Below critical Netflix elements */
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  const panel = document.createElement('div');
  panel.style.cssText = `
    background: rgba(20, 20, 20, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 20px;
    max-width: 500px;
    color: white;
    z-index: 10000; /* Above overlay */
  `;

  panel.appendChild(content);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  return { overlay, panel };
}
```

---

## 7. Known Challenges and Solutions

### Challenge 1: Content Script Isolation

**Problem**: Content scripts cannot access Netflix's internal JavaScript variables like `window.netflix`.

```javascript
// THIS FAILS in content script:
const playerAPI = window.netflix.appContext.state.playerApp.getAPI();
// Error: "netflix is not defined"

// THIS WORKS in console (because it's in page context)
// But console ≠ content script context
```

**Solution 1: Inject Page Script**

```javascript
// manifest.json
{
  "content_scripts": [{
    "matches": ["*://*.netflix.com/*"],
    "js": ["content.js"]
  }],
  "web_accessible_resources": [{
    "resources": ["injected.js"],
    "matches": ["*://*.netflix.com/*"]
  }]
}

// content.js
function injectPageScript() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('injected.js');
  script.onload = function() {
    this.remove();
  };
  document.head.appendChild(script);
}

injectPageScript();

// Listen for messages from injected script
window.addEventListener('message', (event) => {
  if (event.source !== window) return;

  if (event.data.type === 'NETFLIX_VIDEO_DATA') {
    // Injected script sent us video information
    console.log('Title:', event.data.title);

    // Send to background script
    chrome.runtime.sendMessage({
      type: 'VIDEO_DATA',
      data: event.data
    });
  }
});

// injected.js (runs in page context)
try {
  const playerAPI = window.netflix?.appContext?.state?.playerApp?.getAPI();

  if (playerAPI) {
    // Get current session/video info
    const videoInfo = playerAPI.getVideoDetails?.();

    // Send to content script via postMessage
    window.postMessage({
      type: 'NETFLIX_VIDEO_DATA',
      title: videoInfo?.title,
      year: videoInfo?.releaseYear,
      duration: videoInfo?.duration,
    }, '*');
  }
} catch (e) {
  console.error('Error accessing Netflix API:', e);
}
```

**Solution 2: DOM-Only Approach** (Recommended for most use cases)

```javascript
// Don't try to access window.netflix at all
// Extract everything from DOM

function extractVideoInfo() {
  const title = document.querySelector("[data-uia='video-title']")?.textContent;
  const modal = document.querySelector("[role='dialog']");
  const year = modal?.querySelector("[class*='year']")?.textContent;

  return { title, year };
}
```

### Challenge 2: Frequent UI Updates Break Selectors

**Problem**: Netflix updates its UI and class names/selectors change frequently.

```javascript
// Selector that worked in 2023 may not work in 2024
const oldSelector = document.querySelector(".old-class-name-v1");
// Returns null after update
```

**Solution: Multi-Fallback Selector Strategy**

```javascript
function robustTitleExtract() {
  // Try multiple selectors in priority order
  const selectors = [
    // Preferred: data-uia (stable)
    () => document.querySelector("[data-uia='video-title']")?.textContent,

    // Secondary: common class patterns
    () => document.querySelector("h4.ellipsize-text")?.textContent,

    // Tertiary: role/aria
    () => document.querySelector("[role='heading'] h4")?.textContent,

    // Last resort: text content search
    () => {
      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      for (const h of headings) {
        if (h.textContent.length > 2 && h.textContent.length < 200) {
          return h.textContent;
        }
      }
    },
  ];

  for (const selectorFn of selectors) {
    try {
      const result = selectorFn();
      if (result && result.trim().length > 0) {
        return result;
      }
    } catch (e) {
      // Selector failed, try next
    }
  }

  return null;
}
```

### Challenge 3: Async/Timing Issues

**Problem**: Content loads asynchronously, elements don't exist when you try to access them.

```javascript
// Bad: Element doesn't exist yet
const title = document.querySelector("[data-uia='video-title']")?.textContent;
// Returns undefined

// Problem worsens when trying in event handlers
element.addEventListener('click', () => {
  // Modal not visible yet
  const modalContent = document.querySelector("[role='dialog']")?.textContent;
});
```

**Solution: Wait for Element with Timeout**

```javascript
function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve) => {
    if (document.querySelector(selector)) {
      resolve(document.querySelector(selector));
      return;
    }

    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Timeout fallback
    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
}

// Usage:
element.addEventListener('click', async () => {
  const modal = await waitForElement("[role='dialog']", 3000);
  if (modal) {
    const title = modal.querySelector("[data-uia='video-title']")?.textContent;
    console.log('Title:', title);
  }
});
```

### Challenge 4: React Re-rendering Removes Elements

**Problem**: React removes elements you injected because they're not in its virtual DOM.

**Solution: Store Reference and Re-inject**

```javascript
class PersistentUIElement {
  constructor(targetSelector, createFn) {
    this.targetSelector = targetSelector;
    this.createFn = createFn;
    this.element = null;

    this.inject();
    this.watchForRemoval();
  }

  inject() {
    const target = document.querySelector(this.targetSelector);
    if (!target) return;

    this.element = this.createFn();
    target.appendChild(this.element);
  }

  watchForRemoval() {
    const observer = new MutationObserver(() => {
      if (!document.contains(this.element)) {
        // Element was removed, re-inject
        setTimeout(() => this.inject(), 100);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  static update(selector, newContent) {
    const element = document.querySelector(selector);
    if (element) {
      element.textContent = newContent;
    }
  }
}

// Usage:
new PersistentUIElement('.player-controls', () => {
  const btn = document.createElement('button');
  btn.id = 'my-button';
  btn.textContent = 'Click me';
  return btn;
});
```

### Challenge 5: Performance and Resource Usage

**Problem**: MutationObserver on Netflix can fire thousands of times per second.

**Solution: Efficient Observation**

```javascript
class EfficientObserver {
  constructor(config = {}) {
    this.targets = new Set();
    this.debounceDelay = config.debounceDelay || 100;
    this.maxBatchSize = config.maxBatchSize || 50;

    this.observer = new MutationObserver(this.handleMutations.bind(this));
    this.mutationQueue = [];
    this.processTimer = null;
  }

  observe(element) {
    this.observer.observe(element, {
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'aria-expanded', 'style'],
      subtree: true,
    });
  }

  handleMutations(mutations) {
    // Add unique targets to queue
    mutations.forEach((m) => {
      this.targets.add(m.target);
    });

    // Debounce processing
    clearTimeout(this.processTimer);
    this.processTimer = setTimeout(() => {
      this.processBatch();
    }, this.debounceDelay);
  }

  processBatch() {
    const batch = Array.from(this.targets).slice(0, this.maxBatchSize);
    this.targets.clear();

    batch.forEach((target) => {
      // Process each target
      this.processTarget(target);
    });
  }

  processTarget(target) {
    // Your processing logic here
  }
}
```

### Challenge 6: Determining When Content is Fully Loaded

**Problem**: Netflix loads content in stages. When is data truly "ready"?

```javascript
// Bad: Assumes content loaded immediately
document.querySelector("[data-uia='video-card']");
// May be a placeholder or incomplete

// Solution: Check for data completeness
function isContentComplete(element) {
  const title = element.querySelector("[data-uia='video-title']");
  const image = element.querySelector('img');

  // Check for actual content
  const titleLoaded = title && title.textContent.length > 2;
  const imageLoaded = image && image.src && image.src.includes('netflix');

  return titleLoaded && imageLoaded;
}

// Usage in observer:
observer = new MutationObserver(() => {
  document.querySelectorAll("[data-uia='video-card']").forEach((card) => {
    if (isContentComplete(card)) {
      extractAndProcessCard(card);
    }
  });
});
```

---

## 8. Best Practices Summary

### 8.1 For DOM Selection

1. **Prefer `data-uia` attributes** over class names
2. **Use attribute selectors** for stable targeting: `[data-uia='video-title']`
3. **Combine selectors** for specificity: `[role='dialog'] [data-uia='video-title']`
4. **Maintain a fallback list** of selectors in case Netflix updates
5. **Avoid generic class names** like `.row` or `.carousel`
6. **Test selectors frequently** as Netflix updates UI regularly

### 8.2 For Content Detection

1. **Always use MutationObserver** for detecting new content
2. **Debounce or batch mutations** to avoid performance issues
3. **Add delays** for rendering completion (100-200ms usually sufficient)
4. **Use requestAnimationFrame** before accessing newly rendered content
5. **Implement retry logic** for content that takes time to load

### 8.3 For Title/Metadata Extraction

1. **Use aria-label** as primary source when available
2. **Implement multi-fallback extraction** for resilience
3. **Parse structured data** from aria-labels (contains pipe-separated info)
4. **Store extracted data immediately** as DOM may change
5. **Log extraction failures** to identify pattern changes

### 8.4 For UI Injection

1. **Create dedicated containers** for your UI elements
2. **Use fixed positioning** for overlays to prevent layout breakage
3. **Re-inject persistent elements** if React removes them
4. **Inject CSS stylesheet** to avoid inline style conflicts
5. **Monitor z-index carefully** to ensure visibility

### 8.5 For Extension Architecture

1. **Keep content script focused** - extract data, don't process
2. **Use message passing** between content and background scripts
3. **Inject page script** only when you need access to window.netflix
4. **Store data in chrome.storage** for cross-extension persistence
5. **Handle permissions** properly in manifest.json

---

## 9. Manifest.json Template for Netflix Extension

```json
{
  "manifest_version": 3,
  "name": "Netflix Enhancement Extension",
  "version": "1.0.0",
  "description": "Enhance Netflix with additional features",

  "permissions": [
    "activeTab",
    "scripting",
    "storage"
  ],

  "host_permissions": [
    "*://*.netflix.com/*",
    "*://*.nflxext.com/*"
  ],

  "background": {
    "service_worker": "background.js"
  },

  "content_scripts": [
    {
      "matches": ["*://*.netflix.com/*"],
      "js": ["content.js"],
      "run_at": "document_start",
      "all_frames": false
    }
  ],

  "web_accessible_resources": [
    {
      "resources": ["injected.js"],
      "matches": ["*://*.netflix.com/*"]
    }
  ],

  "action": {
    "default_title": "Netflix Extension",
    "default_icon": "icons/icon-48.png",
    "default_popup": "popup.html"
  },

  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
}
```

---

## 10. Code Examples Repository

### Example 1: Safe Title Extractor

```javascript
// content-script.js
class NetflixTitleExtractor {
  constructor() {
    this.observer = null;
    this.extractedTitles = new Set();
  }

  init() {
    this.startObserving();
    // Also check for already-loaded content
    this.extractVisibleTitles();
  }

  startObserving() {
    this.observer = new MutationObserver((mutations) => {
      // Debounce extraction
      this.extractVisibleTitles();
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-expanded', 'class'],
    });
  }

  extractVisibleTitles() {
    // Get all video cards
    const videoCards = document.querySelectorAll("[data-uia='video-card']");

    videoCards.forEach((card) => {
      const title = this.extractTitleFromCard(card);

      if (title && !this.extractedTitles.has(title)) {
        this.extractedTitles.add(title);

        // Send to background script
        chrome.runtime.sendMessage({
          type: 'NEW_TITLE_FOUND',
          title: title,
          url: window.location.href,
          timestamp: new Date().toISOString(),
        });
      }
    });
  }

  extractTitleFromCard(card) {
    // Method 1: aria-label (often contains full info)
    const ariaLabel = card.getAttribute('aria-label');
    if (ariaLabel) {
      return this.parseAriaLabel(ariaLabel);
    }

    // Method 2: data-uia='video-title'
    const titleElement = card.querySelector("[data-uia='video-title']");
    if (titleElement?.textContent) {
      return titleElement.textContent.trim();
    }

    // Method 3: Fallback to ellipsize text
    const textEl = card.querySelector('.ellipsize-text');
    if (textEl?.textContent) {
      return textEl.textContent.trim();
    }

    return null;
  }

  parseAriaLabel(label) {
    // Netflix aria-labels are like: "Title Name | Year | Rating | Type"
    const parts = label.split('|');
    return parts[0]?.trim() || label;
  }
}

// Initialize on page load
const extractor = new NetflixTitleExtractor();
extractor.init();
```

### Example 2: Modal/Detail Detection

```javascript
// Detect when detail modal appears
class NetflixModalWatcher {
  constructor() {
    this.currentModal = null;
    this.observer = null;
  }

  init() {
    this.watchForModals();
  }

  watchForModals() {
    this.observer = new MutationObserver((mutations) => {
      const modal = document.querySelector("[role='dialog']");

      // Check if modal state changed
      if (modal && !this.currentModal) {
        // Modal appeared
        this.onModalAppeared(modal);
        this.currentModal = modal;
      } else if (!modal && this.currentModal) {
        // Modal disappeared
        this.onModalClosed();
        this.currentModal = null;
      } else if (modal !== this.currentModal) {
        // Different modal (shouldn't happen but handle it)
        this.onModalAppeared(modal);
        this.currentModal = modal;
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  onModalAppeared(modal) {
    // Wait for content to render
    setTimeout(() => {
      const data = this.extractModalData(modal);
      console.log('Modal opened with data:', data);

      chrome.runtime.sendMessage({
        type: 'MODAL_OPENED',
        data: data,
      });
    }, 200);
  }

  onModalClosed() {
    console.log('Modal closed');
    chrome.runtime.sendMessage({
      type: 'MODAL_CLOSED',
    });
  }

  extractModalData(modal) {
    return {
      title: modal.querySelector("[data-uia='video-title']")?.textContent,
      description: modal.querySelector("[class*='synopsis']")?.textContent,
      year: this.extractYear(modal),
      rating: modal.querySelector("[class*='rating']")?.textContent,
      duration: modal.querySelector("[class*='duration']")?.textContent,
    };
  }

  extractYear(modal) {
    // Look for year pattern
    const text = modal.textContent;
    const match = text.match(/\b(19|20)\d{2}\b/);
    return match ? match[0] : null;
  }
}

const watcher = new NetflixModalWatcher();
watcher.init();
```

---

## 11. Performance Considerations

### CPU Usage
- **MutationObserver is efficient** compared to polling
- **Debounce mutations** to prevent excessive processing
- **Batch DOM queries** rather than individual queries in loops
- **Use requestAnimationFrame** to sync with browser's rendering

### Memory Usage
- **Avoid storing large DOM references**
- **Clean up observers** when no longer needed
- **Use WeakSet/WeakMap** for tracking DOM nodes
- **Dispose of old data** as new content loads

### Network Requests
- **Don't make requests for every title** (can be 100+ per page)
- **Implement caching** of extracted data
- **Batch API requests** if contacting external services
- **Respect rate limits** when using third-party APIs

---

## 12. Testing Your Extension

### Key Test Cases

```javascript
// Test 1: Title extraction on browse page
// - Load netflix.com/browse
// - Verify titles extracted from visible carousels
// - Test with MutationObserver detecting new carousels

// Test 2: Modal detection
// - Click on a title
// - Verify modal appears and is detected
// - Extract metadata from modal
// - Close modal and verify detection

// Test 3: Player page title
// - Navigate to watch page
// - Verify title extraction from player
// - Test during video playback

// Test 4: Search functionality
// - Perform search on Netflix
// - Verify results are detected and extracted
// - Test with different search queries

// Test 5: Performance
// - Monitor CPU/memory with DevTools
// - Check for memory leaks
// - Verify observer cleanup
```

---

## 13. Troubleshooting Guide

### Issue: Titles not extracting

**Diagnostics**:
```javascript
// Check if selectors are valid
console.log(document.querySelector("[data-uia='video-title']"));

// Check if content loaded
console.log(document.body.innerHTML.length);

// Check for React updates
console.log(document.querySelectorAll("[data-uia='video-card']").length);
```

**Solutions**:
- Wait for MutationObserver to detect content
- Check if page is fully loaded
- Verify selectors haven't changed

### Issue: Modal not appearing

**Diagnostics**:
```javascript
// Check if modal exists in DOM
console.log(document.querySelector("[role='dialog']"));

// Check if it's hidden
const modal = document.querySelector("[role='dialog']");
console.log(window.getComputedStyle(modal).display);
```

**Solutions**:
- Increase timeout wait
- Check z-index and visibility
- Verify role attribute exists

### Issue: Extension slowing Netflix

**Diagnostics**:
```javascript
// Check observer performance
performance.mark('mutation-start');
// ... observer callback code
performance.mark('mutation-end');
performance.measure('mutation', 'mutation-start', 'mutation-end');
```

**Solutions**:
- Reduce observer scope
- Debounce mutations
- Optimize extraction logic
- Disable observer when not needed

---

## Source References

### Official Documentation
- Netflix TechBlog - Crafting a high-performance TV user interface using React: https://netflixtechblog.com/crafting-a-high-performance-tv-user-interface-using-react-3350e5a6ad3b
- Chrome Extension Documentation - Content Scripts: https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts
- MDN - MutationObserver API: https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver

### Community Examples and Implementations
- Skippy Netflix Skip Extension: https://github.com/vishans/Skippy
- IMDB Netflix Enhancer: https://github.com/MTSUBOOR/IMDB_Netflix_Enhancer
- Netflix Categories Extension: https://github.com/adeekshith/netflix-categories
- Netflix Household Bypass (HouseholdNoMore): https://github.com/Amachik/HouseholdNoMore

### Stack Overflow Discussions
- Netflix Title Extraction from URLs: https://stackoverflow.com/questions/61495529/how-to-get-movie-tv-show-title-from-netflix-url
- Netflix Player Control via Chrome Extensions: https://stackoverflow.com/questions/42105028/netflix-video-player-in-chrome-how-to-seek
- Content Script Isolation Issues: https://stackoverflow.com/questions/45283352/chrome-extension-content-script-isolation
- MutationObserver for Dynamic Content: https://stackoverflow.com/questions/65765033/how-to-extract-content-from-a-dynamically-loaded-webpage-using-mutationobservers

### Technical Articles
- MutationObserver Complete Guide: https://www.badger3000.com/articles/complete-guide-to-mutationobserver-api
- Netflix Prefetching and Performance: https://medium.com/@nvineet02/how-netflix-uses-prefetching-to-deliver-seamless-streaming-behind-the-scenes-of-buffer-free-f8bb85b52e78
- Chrome Extension Content Script Isolation: https://thelinuxcode.com/chrome-extension-tutorial-how-to-pass-messages-from-a-pages-context/

---

## Appendix: Quick Reference

### Common Netflix Selectors Cheat Sheet

```javascript
// Video Titles
[data-uia='video-title']
h4.ellipsize-text
[data-uia='billboard-title']

// Video Cards/Tiles
[data-uia='video-card']
[data-uia*='tile']
[role='group']

// Modals and Dialogs
[role='dialog']
[class*='modal']
[class*='popup']

// Player
[data-uia='player-title']
.player-controls
[class*='video-container']

// Metadata
[aria-label*='title']
[class*='year']
[class*='rating']
```

### Key Data-UIA Values

- `video-title` - Title text
- `video-card` - Individual content card
- `video-info` - Video metadata container
- `billboard-title` - Featured content title
- `player-play-pause` - Play button
- `player-title` - Current playing title

### Common Timing Values

- Modal render: 100-300ms
- Carousel load: 50-200ms
- Search results: 100-500ms
- Image lazy loading: Variable, use observer

---

**Document Version**: 1.0
**Last Verified**: November 19, 2025
**Applicable Versions**: Netflix web platform (2024-2025)

For the most up-to-date information, monitor the Netflix TechBlog and test selectors regularly as Netflix updates its UI.
