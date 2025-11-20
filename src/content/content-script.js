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

  // Fetch ratings from service worker
  try {
    const ratings = await fetchRatings(titleInfo);

    if (ratings) {
      console.log('[Netflix Ratings] Received ratings:', ratings);
      injectRatingBadge(card, ratings);
    } else {
      console.log('[Netflix Ratings] No ratings available for:', titleInfo.title);
    }
  } catch (error) {
    console.error('[Netflix Ratings] Error fetching ratings:', error);
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

  // Extract year if available
  const yearElement = card.querySelector('.year, .titleCard-year, .item-year');
  if (yearElement) {
    year = yearElement.textContent.trim();
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
 * Inject rating badge into title card
 *
 * @param {HTMLElement} card - Title card element
 * @param {Object} ratings - Ratings object { imdb?, metacritic?, rottenTomatoes? }
 */
function injectRatingBadge(card, ratings) {
  console.log('[Netflix Ratings] Injecting rating badge into card');

  // Check if badge already exists
  const existingBadge = card.querySelector(`.${CONFIG.RATING_BADGE_CLASS}`);
  if (existingBadge) {
    console.log('[Netflix Ratings] Badge already exists, removing old one');
    existingBadge.remove();
  }

  // Create badge container
  const badge = document.createElement('div');
  badge.className = CONFIG.RATING_BADGE_CLASS;

  // Add individual rating elements
  const ratingElements = [];

  if (ratings.imdb) {
    const imdbElement = createRatingElement('IMDb', ratings.imdb.value, 'imdb');
    ratingElements.push(imdbElement);
  }

  if (ratings.metacritic) {
    const mcElement = createRatingElement('MC', ratings.metacritic.value, 'metacritic');
    ratingElements.push(mcElement);
  }

  if (ratings.rottenTomatoes) {
    const rtElement = createRatingElement('RT', ratings.rottenTomatoes.value, 'rt');
    ratingElements.push(rtElement);
  }

  if (ratingElements.length === 0) {
    console.log('[Netflix Ratings] No ratings to display');
    return;
  }

  ratingElements.forEach(elem => badge.appendChild(elem));

  // Inject badge into card
  const injectionPoint = findBadgeInjectionPoint(card);
  if (injectionPoint) {
    injectionPoint.appendChild(badge);
    console.log('[Netflix Ratings] Badge injected successfully');
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
 * @returns {HTMLElement} Rating element
 */
function createRatingElement(label, value, source) {
  const element = document.createElement('div');
  element.className = `rating-item rating-${source}`;

  const labelSpan = document.createElement('span');
  labelSpan.className = 'rating-label';
  labelSpan.textContent = label;

  const valueSpan = document.createElement('span');
  valueSpan.className = 'rating-value';
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
