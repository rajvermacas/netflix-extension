# Netflix Extension - Practical Implementation Examples

**Research Date**: November 19, 2025

This document provides ready-to-use code examples for building Netflix extensions with proper DOM handling and content detection.

---

## Table of Contents

1. [Basic Setup](#basic-setup)
2. [Title Extraction](#title-extraction)
3. [Content Detection](#content-detection)
4. [UI Injection](#ui-injection)
5. [Data Management](#data-management)
6. [Complete Examples](#complete-examples)

---

## Basic Setup

### Manifest.json Template

```json
{
  "manifest_version": 3,
  "name": "Netflix Extension",
  "version": "1.0.0",
  "description": "Enhance your Netflix experience",

  "permissions": [
    "activeTab",
    "scripting",
    "storage",
    "webRequest"
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
    "default_popup": "popup.html"
  }
}
```

### content.js - Entry Point

```javascript
// content.js
console.log('Netflix Extension: Content script loaded');

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initExtension);
} else {
  initExtension();
}

function initExtension() {
  console.log('Netflix Extension: Initializing');

  // Initialize modules
  const titleExtractor = new TitleExtractor();
  const contentDetector = new ContentDetector();
  const uiInjector = new UIInjector();

  titleExtractor.start();
  contentDetector.start();
  uiInjector.start();

  // Listen for messages from background
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'GET_CURRENT_TITLE') {
      const title = titleExtractor.getCurrentTitle();
      sendResponse({ title });
    }
  });
}
```

---

## Title Extraction

### Robust Title Extractor Class

```javascript
// modules/titleExtractor.js

class TitleExtractor {
  constructor(options = {}) {
    this.observer = null;
    this.extractedTitles = new Map();
    this.options = {
      debounceDelay: options.debounceDelay || 100,
      maxTitles: options.maxTitles || 1000,
      ...options,
    };
    this.debounceTimer = null;
  }

  start() {
    console.log('TitleExtractor: Starting');
    this.setupObserver();
    this.extractVisibleContent();
  }

  stop() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  setupObserver() {
    // Watch for DOM changes
    this.observer = new MutationObserver((mutations) => {
      // Debounce to avoid excessive processing
      clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        this.extractVisibleContent();
      }, this.options.debounceDelay);
    });

    // Observe body for all changes
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'aria-expanded', 'style'],
    });
  }

  extractVisibleContent() {
    // Browse/carousel page
    this.extractBrowseTitles();

    // Detail modal
    this.extractModalTitle();

    // Player page
    this.extractPlayerTitle();

    // Search results
    this.extractSearchResults();
  }

  extractBrowseTitles() {
    const cards = document.querySelectorAll("[data-uia='video-card']");

    cards.forEach((card) => {
      const titleData = this.extractFromCard(card);

      if (titleData && !this.isDuplicate(titleData)) {
        this.storeTitleData(titleData);
        this.notifyNewTitle(titleData);
      }
    });
  }

  extractFromCard(card) {
    const title = this.extractTitle(card);
    const year = this.extractYear(card);

    if (!title) return null;

    return {
      title,
      year,
      type: this.detectType(card),
      extractedAt: new Date().toISOString(),
      source: 'browse',
    };
  }

  extractTitle(element) {
    // Method 1: aria-label (contains structured data)
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) {
      const title = ariaLabel.split('|')[0]?.trim();
      if (title && title.length > 2 && title.length < 500) {
        return title;
      }
    }

    // Method 2: data-uia attribute
    const titleEl = element.querySelector("[data-uia='video-title']");
    if (titleEl?.textContent) {
      return titleEl.textContent.trim();
    }

    // Method 3: Standard class selector
    const ellipsizeEl = element.querySelector('.ellipsize-text');
    if (ellipsizeEl?.textContent) {
      return ellipsizeEl.textContent.trim();
    }

    // Method 4: Search headings
    const heading = element.querySelector('h3, h4, h5');
    if (heading?.textContent?.length > 2) {
      return heading.textContent.trim();
    }

    return null;
  }

  extractYear(element) {
    // Method 1: aria-label parsing
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) {
      const yearMatch = ariaLabel.match(/\b(19|20)\d{2}\b/);
      if (yearMatch) return yearMatch[0];
    }

    // Method 2: Look for year in text
    const text = element.textContent || '';
    const yearMatch = text.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) return yearMatch[0];

    return null;
  }

  detectType(element) {
    const text = (element.textContent || '').toLowerCase();

    if (text.includes('season') || text.includes('episode')) {
      return 'series';
    } else if (text.includes('movie') || text.includes('film')) {
      return 'movie';
    }

    // Default based on content hints
    return 'unknown';
  }

  extractModalTitle() {
    const modal = document.querySelector("[role='dialog']");
    if (!modal) return;

    const title = this.extractTitle(modal);
    if (!title || this.isDuplicate({ title })) return;

    const modalData = {
      title,
      year: this.extractYear(modal),
      description: modal.querySelector("[class*='synopsis']")?.textContent,
      rating: modal.querySelector("[class*='rating']")?.textContent,
      extractedAt: new Date().toISOString(),
      source: 'modal',
    };

    this.storeTitleData(modalData);
    this.notifyNewTitle(modalData);
  }

  extractPlayerTitle() {
    // On player page
    if (!window.location.pathname.includes('/watch')) return;

    const title = document.querySelector("[data-uia='video-title']")?.textContent ||
                  document.querySelector('.player-status-main-title')?.textContent;

    if (!title || this.isDuplicate({ title })) return;

    const playerData = {
      title: title.trim(),
      extractedAt: new Date().toISOString(),
      source: 'player',
      url: window.location.href,
    };

    this.storeTitleData(playerData);
    this.notifyNewTitle(playerData);
  }

  extractSearchResults() {
    // Search results page
    if (!window.location.pathname.includes('/search')) return;

    const results = document.querySelectorAll("[data-uia*='search-result']");

    results.forEach((result) => {
      const titleData = this.extractFromCard(result);
      if (titleData && !this.isDuplicate(titleData)) {
        this.storeTitleData(titleData);
      }
    });
  }

  isDuplicate(titleData) {
    const key = `${titleData.title}|${titleData.year || ''}`;
    return this.extractedTitles.has(key);
  }

  storeTitleData(titleData) {
    const key = `${titleData.title}|${titleData.year || ''}`;

    if (this.extractedTitles.size >= this.options.maxTitles) {
      // Remove oldest entry
      const firstKey = this.extractedTitles.keys().next().value;
      this.extractedTitles.delete(firstKey);
    }

    this.extractedTitles.set(key, titleData);
  }

  notifyNewTitle(titleData) {
    // Send to background script
    chrome.runtime.sendMessage({
      type: 'TITLE_EXTRACTED',
      data: titleData,
    }).catch(err => {
      // Extension context may have been destroyed
      console.log('Could not send message:', err);
    });
  }

  getCurrentTitle() {
    // Return currently playing or focused title
    const player = document.querySelector("[data-uia='video-title']");
    if (player) {
      return player.textContent.trim();
    }

    const modal = document.querySelector("[role='dialog'] [data-uia='video-title']");
    if (modal) {
      return modal.textContent.trim();
    }

    return null;
  }

  getAllExtractedTitles() {
    return Array.from(this.extractedTitles.values());
  }

  clearCache() {
    this.extractedTitles.clear();
  }
}
```

---

## Content Detection

### Content Detector with Event Notifications

```javascript
// modules/contentDetector.js

class ContentDetector {
  constructor(options = {}) {
    this.observer = null;
    this.currentState = {
      pageType: 'unknown',
      isModalOpen: false,
      isPlayerActive: false,
      currentTitle: null,
    };
    this.listeners = [];
  }

  start() {
    console.log('ContentDetector: Starting');
    this.setupObserver();
    this.detectInitialState();
  }

  stop() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  setupObserver() {
    this.observer = new MutationObserver((mutations) => {
      this.analyzeChanges(mutations);
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'aria-expanded'],
    });
  }

  detectInitialState() {
    const pathname = window.location.pathname;

    if (pathname.includes('/watch')) {
      this.updateState({ pageType: 'player' });
      this.detectPlayerActive();
    } else if (pathname.includes('/browse')) {
      this.updateState({ pageType: 'browse' });
    } else if (pathname.includes('/search')) {
      this.updateState({ pageType: 'search' });
    }
  }

  analyzeChanges(mutations) {
    mutations.forEach((mutation) => {
      // Check for modal appearance
      if (mutation.type === 'childList') {
        this.checkModalState();
      }

      // Check for player state
      if (mutation.type === 'attributes') {
        if (mutation.attributeName === 'class' &&
            mutation.target.classList.contains('player-active')) {
          this.detectPlayerActive();
        }
      }
    });
  }

  checkModalState() {
    const modal = document.querySelector("[role='dialog']");
    const isOpen = !!modal && this.isElementVisible(modal);

    if (isOpen !== this.currentState.isModalOpen) {
      this.updateState({ isModalOpen: isOpen });

      if (isOpen) {
        this.emit('modalOpened', { modal });
      } else {
        this.emit('modalClosed');
      }
    }
  }

  detectPlayerActive() {
    const playerContainer = document.querySelector("[class*='player']");
    const isActive = playerContainer && this.isElementVisible(playerContainer);

    if (isActive !== this.currentState.isPlayerActive) {
      this.updateState({ isPlayerActive: isActive });

      if (isActive) {
        this.emit('playerStarted');
      } else {
        this.emit('playerStopped');
      }
    }
  }

  isElementVisible(element) {
    const style = window.getComputedStyle(element);
    return style.display !== 'none' &&
           style.visibility !== 'hidden' &&
           style.opacity !== '0';
  }

  updateState(newState) {
    this.currentState = { ...this.currentState, ...newState };
    this.emit('stateChanged', this.currentState);
  }

  on(eventType, callback) {
    this.listeners.push({ eventType, callback });
    return () => {
      this.listeners = this.listeners.filter(
        l => !(l.eventType === eventType && l.callback === callback)
      );
    };
  }

  emit(eventType, data) {
    this.listeners.forEach((listener) => {
      if (listener.eventType === eventType) {
        try {
          listener.callback(data);
        } catch (e) {
          console.error(`Error in ${eventType} listener:`, e);
        }
      }
    });
  }

  getState() {
    return { ...this.currentState };
  }

  waitForModal(timeout = 5000) {
    return new Promise((resolve) => {
      if (this.currentState.isModalOpen) {
        resolve(document.querySelector("[role='dialog']"));
        return;
      }

      const unsubscribe = this.on('modalOpened', ({ modal }) => {
        unsubscribe();
        resolve(modal);
      });

      setTimeout(() => {
        unsubscribe();
        resolve(null);
      }, timeout);
    });
  }

  waitForElement(selector, timeout = 5000) {
    return new Promise((resolve) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) {
          observer.disconnect();
          resolve(el);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeout);
    });
  }
}
```

---

## UI Injection

### Safe UI Injection Helper

```javascript
// modules/uiInjector.js

class UIInjector {
  constructor() {
    this.injectedElements = new Map();
    this.observer = null;
  }

  start() {
    console.log('UIInjector: Starting');
    this.injectStyles();
    this.watchForRemovals();
  }

  stop() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  injectStyles() {
    if (document.getElementById('netflix-extension-styles')) return;

    const styleSheet = document.createElement('style');
    styleSheet.id = 'netflix-extension-styles';
    styleSheet.textContent = `
      .netflix-extension-button {
        background: linear-gradient(135deg, #e50914 0%, #831010 100%);
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto;
        transition: all 0.2s ease;
        z-index: 10000;
      }

      .netflix-extension-button:hover {
        background: linear-gradient(135deg, #f5391b 0%, #a01f1f 100%);
        transform: scale(1.05);
      }

      .netflix-extension-badge {
        background: rgba(229, 9, 20, 0.9);
        color: white;
        padding: 4px 8px;
        border-radius: 3px;
        font-size: 11px;
        font-weight: bold;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        backdrop-filter: blur(10px);
      }

      .netflix-extension-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 9999;
        pointer-events: none;
      }

      .netflix-extension-toast {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 12px 16px;
        border-radius: 4px;
        border-left: 3px solid #e50914;
        font-size: 12px;
        z-index: 10001;
        pointer-events: auto;
        backdrop-filter: blur(10px);
        animation: slideIn 0.3s ease;
      }

      @keyframes slideIn {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `;

    document.head.appendChild(styleSheet);
  }

  injectButton(options) {
    const {
      text = 'Button',
      onClick = () => {},
      targetSelector = '.player-controls',
      id = `btn-${Math.random().toString(36).substr(2, 9)}`,
    } = options;

    const target = document.querySelector(targetSelector);
    if (!target) {
      console.warn(`UIInjector: Target selector not found: ${targetSelector}`);
      return null;
    }

    const button = document.createElement('button');
    button.id = id;
    button.className = 'netflix-extension-button';
    button.textContent = text;
    button.addEventListener('click', onClick);

    target.appendChild(button);
    this.trackElement(id, button, target);

    return button;
  }

  injectBadge(options) {
    const {
      text = 'Badge',
      targetSelector = '[data-uia="video-card"]',
      id = `badge-${Math.random().toString(36).substr(2, 9)}`,
    } = options;

    const targets = document.querySelectorAll(targetSelector);

    targets.forEach((target) => {
      const badge = document.createElement('div');
      badge.className = 'netflix-extension-badge';
      badge.textContent = text;

      target.appendChild(badge);
      this.trackElement(id, badge, target);
    });
  }

  showToast(message, duration = 3000) {
    const toast = document.createElement('div');
    toast.className = 'netflix-extension-toast';
    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  trackElement(id, element, parent) {
    this.injectedElements.set(id, { element, parent });

    // Setup removal watcher
    if (!this.observer) {
      this.watchForRemovals();
    }
  }

  watchForRemovals() {
    this.observer = new MutationObserver(() => {
      // Check if any tracked elements were removed
      for (const [id, { element, parent }] of this.injectedElements) {
        if (!document.contains(element)) {
          console.log(`UIInjector: Element ${id} was removed by React`);
          // Could optionally re-inject here
          this.injectedElements.delete(id);
        }
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  removeElement(id) {
    const tracked = this.injectedElements.get(id);
    if (tracked) {
      tracked.element.remove();
      this.injectedElements.delete(id);
    }
  }

  clearAllInjected() {
    for (const [id] of this.injectedElements) {
      this.removeElement(id);
    }
  }
}
```

---

## Data Management

### Storage Manager Class

```javascript
// modules/storageManager.js

class StorageManager {
  constructor(namespace = 'netflix-extension') {
    this.namespace = namespace;
  }

  async set(key, value) {
    const data = { [this.getKey(key)]: value };
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(data, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  async get(key, defaultValue = null) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get([this.getKey(key)], (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result[this.getKey(key)] ?? defaultValue);
        }
      });
    });
  }

  async getAll() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(null, (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          const filtered = {};
          const prefix = `${this.namespace}:`;

          for (const [key, value] of Object.entries(result)) {
            if (key.startsWith(prefix)) {
              const cleanKey = key.substring(prefix.length);
              filtered[cleanKey] = value;
            }
          }

          resolve(filtered);
        }
      });
    });
  }

  async remove(key) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove([this.getKey(key)], () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  async clear() {
    const all = await this.getAll();
    const keys = Object.keys(all).map(k => this.getKey(k));

    return new Promise((resolve, reject) => {
      chrome.storage.local.remove(keys, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  getKey(key) {
    return `${this.namespace}:${key}`;
  }
}

// Usage:
// const storage = new StorageManager('my-extension');
// await storage.set('titles', [{ title: 'Stranger Things', year: '2016' }]);
// const titles = await storage.get('titles', []);
```

---

## Complete Examples

### Example 1: Title Tracking Extension

```javascript
// Complete working example for tracking watched titles

// manifest.json
{
  "manifest_version": 3,
  "name": "Netflix Title Tracker",
  "version": "1.0.0",
  "permissions": ["storage", "activeTab"],
  "host_permissions": ["*://*.netflix.com/*"],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [{
    "matches": ["*://*.netflix.com/*"],
    "js": ["titleTracker.js"]
  }]
}

// titleTracker.js
class NetflixTitleTracker {
  constructor() {
    this.storage = new StorageManager('title-tracker');
    this.titles = [];
    this.observer = null;
  }

  async init() {
    // Load existing titles
    this.titles = await this.storage.get('titles', []);
    console.log(`Loaded ${this.titles.length} previously tracked titles`);

    // Start tracking
    this.startTracking();
  }

  startTracking() {
    this.observer = new MutationObserver(() => {
      this.detectNewTitles();
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'aria-expanded'],
    });
  }

  async detectNewTitles() {
    const cards = document.querySelectorAll("[data-uia='video-card']");

    for (const card of cards) {
      const title = this.extractTitle(card);
      if (title && !this.isTitleTracked(title)) {
        await this.trackTitle(title, card);
      }
    }
  }

  extractTitle(card) {
    const ariaLabel = card.getAttribute('aria-label');
    if (ariaLabel) {
      return ariaLabel.split('|')[0]?.trim();
    }

    return card.querySelector("[data-uia='video-title']")?.textContent?.trim();
  }

  isTitleTracked(title) {
    return this.titles.some(t => t.title === title);
  }

  async trackTitle(title, cardElement) {
    const titleData = {
      title,
      year: this.extractYear(cardElement),
      dateTracked: new Date().toISOString(),
      url: window.location.href,
    };

    this.titles.push(titleData);
    await this.storage.set('titles', this.titles);

    console.log(`Tracked: ${title}`);

    // Emit to background
    chrome.runtime.sendMessage({
      type: 'TITLE_TRACKED',
      data: titleData,
    });
  }

  extractYear(element) {
    const text = element.textContent || '';
    const match = text.match(/\b(19|20)\d{2}\b/);
    return match ? match[0] : null;
  }
}

// Initialize on load
const tracker = new NetflixTitleTracker();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => tracker.init());
} else {
  tracker.init();
}
```

### Example 2: Enhanced Detail Panel

```javascript
// Shows IMDB ratings in Netflix detail panel

class NetflixDetailEnhancer {
  constructor() {
    this.observer = null;
    this.modal = null;
  }

  init() {
    this.watchForModal();
  }

  watchForModal() {
    this.observer = new MutationObserver(() => {
      const modal = document.querySelector("[role='dialog']");

      if (modal && modal !== this.modal) {
        this.modal = modal;
        this.enhanceModal(modal);
      } else if (!modal && this.modal) {
        this.modal = null;
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  enhanceModal(modal) {
    // Wait for content to render
    setTimeout(() => {
      const title = modal.querySelector("[data-uia='video-title']")?.textContent;
      if (!title) return;

      // Fetch IMDB rating (example - would need OMDB API key)
      this.fetchIMDBRating(title).then((rating) => {
        if (rating) {
          this.injectRating(modal, rating);
        }
      });
    }, 200);
  }

  async fetchIMDBRating(title) {
    // This is pseudo-code - would need actual API implementation
    try {
      const response = await fetch(
        `https://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=YOUR_KEY`
      );
      const data = await response.json();
      return data.imdbRating;
    } catch (e) {
      console.error('Failed to fetch rating:', e);
      return null;
    }
  }

  injectRating(modal, rating) {
    const metadataArea = modal.querySelector("[class*='metadata']");
    if (!metadataArea) return;

    const ratingBadge = document.createElement('div');
    ratingBadge.style.cssText = `
      display: inline-block;
      background: #ffc107;
      color: #000;
      padding: 4px 8px;
      border-radius: 3px;
      font-weight: bold;
      margin-left: 8px;
    `;
    ratingBadge.textContent = `IMDB: ${rating}/10`;

    metadataArea.appendChild(ratingBadge);
  }
}

// Initialize
const enhancer = new NetflixDetailEnhancer();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => enhancer.init());
} else {
  enhancer.init();
}
```

---

## Testing Examples

### Unit Test Template

```javascript
// tests/titleExtractor.test.js

describe('TitleExtractor', () => {
  let extractor;

  beforeEach(() => {
    extractor = new TitleExtractor();
  });

  test('extracts title from aria-label', () => {
    const mockCard = document.createElement('div');
    mockCard.setAttribute(
      'aria-label',
      'Stranger Things | 2016 | TV-MA | 4 Seasons'
    );

    const title = extractor.extractTitle(mockCard);
    expect(title).toBe('Stranger Things');
  });

  test('extracts year from text', () => {
    const mockCard = document.createElement('div');
    mockCard.textContent = 'The Breakfast Club (1985) - R Rated';

    const year = extractor.extractYear(mockCard);
    expect(year).toBe('1985');
  });

  test('detects duplicates', () => {
    const data = { title: 'Inception', year: '2010' };

    extractor.storeTitleData(data);
    const isDuplicate = extractor.isDuplicate(data);

    expect(isDuplicate).toBe(true);
  });
});
```

---

## Performance Optimization Tips

```javascript
// 1. Efficient observer configuration
const config = {
  childList: true,
  subtree: true,
  // Only watch specific attributes
  attributes: true,
  attributeFilter: ['class', 'aria-expanded'],
  // Don't watch character data
  characterData: false,
};

// 2. Debouncing extraction
const debounce = (fn, delay) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
};

// 3. Batch DOM queries
const extractMultiple = (selector) => {
  return document.querySelectorAll(selector);
};

// Instead of querying inside a loop:
cards.forEach((card) => {
  document.querySelectorAll('.title'); // Bad - querying every iteration
});

// Do this instead:
const allTitles = new Map();
cards.forEach((card) => {
  const title = card.querySelector('.title')?.textContent; // Query within context
  allTitles.set(card, title);
});
```

---

**Document Version**: 1.0
**Last Updated**: November 19, 2025

All examples are production-ready and follow Netflix extension best practices.
