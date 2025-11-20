/**
 * Netflix Content Script
 *
 * Injected into Netflix pages to:
 * - Detect movie/series titles
 * - Fetch ratings from OMDB via service worker
 * - Inject rating badges into Netflix DOM
 *
 * @module ContentScript
 */

console.log('[Netflix Ratings] Content script loaded');

// Configuration
const CONFIG = {
  DEBOUNCE_DELAY_MS: 200,
  RATING_BADGE_CLASS: 'netflix-ratings-badge',
  PROCESSED_ATTRIBUTE: 'data-ratings-processed',
};

// State management
let debounceTimer = null;
let processedElements = new WeakSet();
let observer = null;

/**
 * Initialize the content script
 */
function init() {
  console.log('[Netflix Ratings] Initializing content script');

  // Process existing content
  processExistingContent();

  // Set up observer for dynamic content
  setupMutationObserver();

  console.log('[Netflix Ratings] Initialization complete');
}

/**
 * Process all existing title cards on the page
 */
function processExistingContent() {
  console.log('[Netflix Ratings] Processing existing content');

  const titleCards = findAllTitleCards();
  console.log(`[Netflix Ratings] Found ${titleCards.length} title cards`);

  titleCards.forEach((card, index) => {
    console.log(`[Netflix Ratings] Processing card ${index + 1}/${titleCards.length}`);
    processTitleCard(card);
  });
}

/**
 * Set up MutationObserver to detect dynamically loaded content
 */
function setupMutationObserver() {
  console.log('[Netflix Ratings] Setting up MutationObserver');

  if (observer) {
    console.log('[Netflix Ratings] Observer already exists, disconnecting');
    observer.disconnect();
  }

  observer = new MutationObserver((mutations) => {
    console.log(`[Netflix Ratings] Detected ${mutations.length} DOM mutations`);

    // Debounce to avoid excessive processing
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      console.log('[Netflix Ratings] Debounce timer fired, processing mutations');
      handleMutations(mutations);
    }, CONFIG.DEBOUNCE_DELAY_MS);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  console.log('[Netflix Ratings] MutationObserver started');
}

/**
 * Handle detected mutations
 *
 * @param {MutationRecord[]} mutations - Array of mutation records
 */
function handleMutations(mutations) {
  const newTitleCards = new Set();

  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        // Check if the node itself is a title card
        if (isTitleCard(node)) {
          newTitleCards.add(node);
        }

        // Check for title cards within the node
        const cards = findTitleCardsInElement(node);
        cards.forEach(card => newTitleCards.add(card));
      }
    });
  });

  console.log(`[Netflix Ratings] Found ${newTitleCards.size} new title cards`);

  newTitleCards.forEach((card) => {
    if (!processedElements.has(card)) {
      processTitleCard(card);
    }
  });
}

/**
 * Find all title cards on the page using multiple fallback selectors
 *
 * @returns {HTMLElement[]} Array of title card elements
 */
function findAllTitleCards() {
  console.log('[Netflix Ratings] Searching for title cards');

  const selectors = [
    '[data-uia="video-card"]',          // Primary: Most reliable
    '.title-card-container',             // Browse page cards
    '.slider-item',                      // Carousel items
    '.my-list-item',                     // My List items
    '[role="dialog"]',                   // Detail modals
    '.billboard-row',                    // Homepage billboard
    '.jawBone',                          // Jawbone preview
  ];

  const cards = [];
  selectors.forEach((selector) => {
    const elements = document.querySelectorAll(selector);
    console.log(`[Netflix Ratings] Selector "${selector}" found ${elements.length} elements`);
    cards.push(...Array.from(elements));
  });

  // Remove duplicates
  const uniqueCards = [...new Set(cards)];
  console.log(`[Netflix Ratings] Total unique cards: ${uniqueCards.length}`);

  return uniqueCards;
}

/**
 * Find title cards within a specific element
 *
 * @param {HTMLElement} element - Parent element to search
 * @returns {HTMLElement[]} Array of title card elements
 */
function findTitleCardsInElement(element) {
  const selectors = [
    '[data-uia="video-card"]',
    '.title-card-container',
    '.slider-item',
  ];

  const cards = [];
  selectors.forEach((selector) => {
    const elements = element.querySelectorAll(selector);
    cards.push(...Array.from(elements));
  });

  return cards;
}

/**
 * Check if an element is a title card
 *
 * @param {HTMLElement} element - Element to check
 * @returns {boolean} True if element is a title card
 */
function isTitleCard(element) {
  return (
    element.hasAttribute('data-uia') && element.getAttribute('data-uia') === 'video-card' ||
    element.classList.contains('title-card-container') ||
    element.classList.contains('slider-item')
  );
}

/**
 * Process a single title card
 *
 * @param {HTMLElement} card - Title card element
 */
async function processTitleCard(card) {
  // Skip if already processed
  if (processedElements.has(card)) {
    console.log('[Netflix Ratings] Card already processed, skipping');
    return;
  }

  console.log('[Netflix Ratings] Processing title card');

  // Mark as processed to avoid duplicate processing
  processedElements.add(card);
  card.setAttribute(CONFIG.PROCESSED_ATTRIBUTE, 'true');

  // Extract title information
  const titleInfo = extractTitleInfo(card);

  if (!titleInfo || !titleInfo.title) {
    console.log('[Netflix Ratings] Could not extract title from card, skipping');
    return;
  }

  console.log('[Netflix Ratings] Extracted title info:', titleInfo);

  // Try to fetch ratings from cache immediately (cache-first strategy)
  let ratings = await fetchRatingsCached(titleInfo);

  if (ratings) {
    console.log('[Netflix Ratings] Received ratings from cache:', ratings);
    injectRatingBadge(card, ratings, { isFromCache: true });
  }

  // Fetch fresh ratings in background (non-blocking)
  try {
    refreshRatingsInBackground(card, titleInfo);
  } catch (error) {
    console.error('[Netflix Ratings] Error starting background refresh:', error);
  }
}

/**
 * Extract title information from a card element
 *
 * @param {HTMLElement} card - Title card element
 * @returns {Object|null} Title info { title, year?, type? }
 */
function extractTitleInfo(card) {
  console.log('[Netflix Ratings] Extracting title info from card');

  let title = null;
  let year = null;
  let type = null;

  // Strategy 1: data-uia="video-title" attribute
  const titleElement = card.querySelector('[data-uia="video-title"]');
  if (titleElement) {
    title = titleElement.textContent.trim();
    console.log('[Netflix Ratings] Found title via data-uia:', title);
  }

  // Strategy 2: aria-label attribute on links or cards
  if (!title) {
    const linkWithLabel = card.querySelector('a[aria-label]');
    if (linkWithLabel) {
      title = linkWithLabel.getAttribute('aria-label').trim();
      console.log('[Netflix Ratings] Found title via aria-label:', title);
    }
  }

  // Strategy 3: img alt attribute (for logos/title treatments)
  if (!title) {
    const imgWithAlt = card.querySelector('img[alt]');
    if (imgWithAlt && imgWithAlt.alt.trim().length > 0) {
      title = imgWithAlt.alt.trim();
      console.log('[Netflix Ratings] Found title via img alt:', title);
    }
  }

  // Strategy 4: fallback-text class
  if (!title) {
    const fallbackText = card.querySelector('.fallback-text');
    if (fallbackText) {
      title = fallbackText.textContent.trim();
      console.log('[Netflix Ratings] Found title via fallback-text:', title);
    }
  }

  // Strategy 5: For dialog/modal, use aria-label on dialog
  if (!title && card.getAttribute('role') === 'dialog') {
    title = card.getAttribute('aria-label');
    console.log('[Netflix Ratings] Found title via dialog aria-label:', title);
  }

  // Extract year if available - try multiple strategies
  year = extractYear(card);
  if (year) {
    console.log('[Netflix Ratings] Found year:', year);
  }

  // Clean up title (remove season/episode info)
  if (title) {
    title = cleanTitle(title);
    console.log('[Netflix Ratings] Cleaned title:', title);
  }

  if (!title) {
    console.log('[Netflix Ratings] Could not extract title from card');
    return null;
  }

  return { title, year, type };
}

/**
 * Extract year from card using multiple strategies
 *
 * @param {HTMLElement} card - Title card element
 * @returns {string|null} Year or null if not found
 */
function extractYear(card) {
  // Strategy 1: Direct year element selectors
  const yearSelectors = [
    '.year',
    '.titleCard-year',
    '.item-year',
    '.video-metadata-year',
    '.year-text',
    '.release-year',
    '[data-uia="mini-modal-year"]',
    '.metadata-year',
  ];

  for (const selector of yearSelectors) {
    const element = card.querySelector(selector);
    if (element) {
      const text = element.textContent.trim();
      const year = extractYearFromText(text);
      if (year) {
        console.log('[Netflix Ratings] Year found via selector:', selector, '→', year);
        return year;
      }
    }
  }

  // Strategy 2: Search in text content for year pattern (4 digits between 1900-2100)
  const allText = card.textContent;
  const yearMatch = allText.match(/\b(19\d{2}|20[0-9]{2})\b/);
  if (yearMatch) {
    console.log('[Netflix Ratings] Year found via text pattern:', yearMatch[1]);
    return yearMatch[1];
  }

  // Strategy 3: Look in metadata strings like "2024 | 2h 30m | Drama"
  const metadataElements = card.querySelectorAll('span, div, p');
  for (const elem of metadataElements) {
    const text = elem.textContent.trim();
    // Match pattern like "2024 |" or "2024, "
    const metaMatch = text.match(/^(19\d{2}|20[0-9]{2})\s*[|,]/);
    if (metaMatch) {
      console.log('[Netflix Ratings] Year found via metadata pattern:', metaMatch[1]);
      return metaMatch[1];
    }
  }

  // Strategy 4: Billboard/hero specific selectors
  const billboardYear = card.querySelector('.billboard-year, .hero-year, .preview-year');
  if (billboardYear) {
    const text = billboardYear.textContent.trim();
    const year = extractYearFromText(text);
    if (year) {
      console.log('[Netflix Ratings] Year found via billboard selector:', year);
      return year;
    }
  }

  return null;
}

/**
 * Extract 4-digit year from text
 *
 * @param {string} text - Text to search
 * @returns {string|null} Year or null if not found
 */
function extractYearFromText(text) {
  const match = text.match(/\b(19\d{2}|20[0-9]{2})\b/);
  return match ? match[1] : null;
}

/**
 * Clean title by removing season/episode information
 *
 * @param {string} title - Raw title text
 * @returns {string} Cleaned title
 */
function cleanTitle(title) {
  // Remove season/episode info (e.g., "Title: Season 1: Episode 1")
  const colonIndex = title.indexOf(':');
  if (colonIndex !== -1) {
    const beforeColon = title.substring(0, colonIndex).trim();
    // Only keep part before colon if it looks like a title (not empty, reasonable length)
    if (beforeColon.length >= 2) {
      console.log('[Netflix Ratings] Removed season/episode info from title');
      return beforeColon;
    }
  }

  return title;
}

/**
 * Fetch ratings for a title from the service worker
 *
 * @param {Object} titleInfo - Title information { title, year?, type? }
 * @returns {Promise<Object|null>} Ratings object or null
 */
async function fetchRatings(titleInfo) {
  console.log('[Netflix Ratings] Sending message to service worker:', titleInfo);

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'FETCH_RATINGS',
      payload: titleInfo,
    });

    console.log('[Netflix Ratings] Received response from service worker:', response);

    if (response && response.success) {
      return response.ratings;
    } else {
      console.log('[Netflix Ratings] Service worker returned error:', response?.error);
      return null;
    }
  } catch (error) {
    console.error('[Netflix Ratings] Error communicating with service worker:', error);
    return null;
  }
}

/**
 * Fetch ratings with cache check (cache-first strategy)
 * Uses synchronous memory cache for immediate availability on page reload
 *
 * @param {Object} titleInfo - Title information { title, year?, type? }
 * @returns {Promise<Object|null>} Ratings object or null
 */
async function fetchRatingsCached(titleInfo) {
  console.log('[Netflix Ratings] Fetching ratings (cache-first):', titleInfo);

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'FETCH_RATINGS_CACHED',
      payload: titleInfo,
    });

    console.log('[Netflix Ratings] Received cached response from service worker:', response);

    if (response && response.success) {
      return response.ratings;
    } else {
      console.log('[Netflix Ratings] Service worker returned no cached data:', response?.error);
      return null;
    }
  } catch (error) {
    console.error('[Netflix Ratings] Error fetching cached ratings:', error);
    return null;
  }
}

/**
 * Refresh ratings in background without blocking UI
 * If fresh data differs from cache, updates the badge
 *
 * @param {HTMLElement} card - Title card element
 * @param {Object} titleInfo - Title information { title, year?, type? }
 */
async function refreshRatingsInBackground(card, titleInfo) {
  try {
    console.log('[Netflix Ratings] Starting background refresh:', titleInfo);

    // Fetch fresh ratings from service worker (will hit API if cache is stale)
    const ratings = await fetchRatings(titleInfo);

    if (ratings) {
      console.log('[Netflix Ratings] Background refresh complete, updating badge');
      // Update the badge with fresh data
      injectRatingBadge(card, ratings, { isFromCache: false });
    }
  } catch (error) {
    console.error('[Netflix Ratings] Error in background refresh:', error);
  }
}

/**
 * Inject rating badge into title card
 *
 * @param {HTMLElement} card - Title card element
 * @param {Object} ratings - Ratings object { imdb?, metacritic?, rottenTomatoes? }
 * @param {Object} options - Options { isFromCache?: boolean }
 */
function injectRatingBadge(card, ratings, options = {}) {
  console.log('[Netflix Ratings] Injecting rating badge into card', options.isFromCache ? '[CACHED]' : '[FRESH]');

  // Check if badge already exists
  const existingBadge = card.querySelector(`.${CONFIG.RATING_BADGE_CLASS}`);
  if (existingBadge) {
    console.log('[Netflix Ratings] Badge already exists, removing old one');
    existingBadge.remove();
  }

  // Create badge container
  const badge = document.createElement('div');
  badge.className = CONFIG.RATING_BADGE_CLASS;

  // Always add all three rating sources, showing 'N/A' for missing ones
  const ratingElements = [];

  // IMDb rating
  const imdbValue = ratings.imdb ? ratings.imdb.value : 'N/A';
  const imdbElement = createRatingElement('IMDb', imdbValue, 'imdb', !ratings.imdb);
  ratingElements.push(imdbElement);

  // Metacritic rating
  const mcValue = ratings.metacritic ? ratings.metacritic.value : 'N/A';
  const mcElement = createRatingElement('MC', mcValue, 'metacritic', !ratings.metacritic);
  ratingElements.push(mcElement);

  // Rotten Tomatoes rating
  const rtValue = ratings.rottenTomatoes ? ratings.rottenTomatoes.value : 'N/A';
  const rtElement = createRatingElement('RT', rtValue, 'rt', !ratings.rottenTomatoes);
  ratingElements.push(rtElement);

  ratingElements.forEach(elem => badge.appendChild(elem));

  // Inject badge into card
  const injectionPoint = findBadgeInjectionPoint(card);
  if (injectionPoint) {
    injectionPoint.appendChild(badge);
    console.log('[Netflix Ratings] Badge injected successfully with all 3 rating sources');
  } else {
    console.log('[Netflix Ratings] Could not find suitable injection point');
  }
}

/**
 * Create a single rating element
 *
 * @param {string} label - Rating label (e.g., 'IMDb', 'MC', 'RT')
 * @param {string} value - Rating value
 * @param {string} source - Rating source identifier
 * @param {boolean} isUnavailable - Whether the rating is unavailable (N/A)
 * @returns {HTMLElement} Rating element
 */
function createRatingElement(label, value, source, isUnavailable = false) {
  const element = document.createElement('div');
  element.className = `rating-item rating-${source}${isUnavailable ? ' rating-na' : ''}`;

  const labelSpan = document.createElement('span');
  labelSpan.className = 'rating-label';
  labelSpan.textContent = label;

  const valueSpan = document.createElement('span');
  valueSpan.className = `rating-value${isUnavailable ? ' na' : ''}`;
  valueSpan.textContent = value;

  element.appendChild(labelSpan);
  element.appendChild(valueSpan);

  return element;
}

/**
 * Find the best injection point for the rating badge
 *
 * @param {HTMLElement} card - Title card element
 * @returns {HTMLElement|null} Injection point element
 */
function findBadgeInjectionPoint(card) {
  console.log('[Netflix Ratings] Finding badge injection point');

  // Try to find metadata wrapper
  let injectionPoint = card.querySelector('.titleCard--metadataWrapper, .titleCard-metadataWrapper');
  if (injectionPoint) {
    console.log('[Netflix Ratings] Using metadata wrapper as injection point');
    return injectionPoint;
  }

  // Try to find boxart container
  injectionPoint = card.querySelector('.boxart-container, .boxart-size-16x9');
  if (injectionPoint) {
    console.log('[Netflix Ratings] Using boxart container as injection point');
    return injectionPoint;
  }

  // Fall back to card itself
  console.log('[Netflix Ratings] Using card itself as injection point');
  return card;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Re-initialize on navigation (SPA behavior)
let lastUrl = location.href;
new MutationObserver(() => {
  const currentUrl = location.href;
  if (currentUrl !== lastUrl) {
    console.log('[Netflix Ratings] URL changed, re-initializing');
    lastUrl = currentUrl;
    processedElements = new WeakSet();
    init();
  }
}).observe(document, { subtree: true, childList: true });
