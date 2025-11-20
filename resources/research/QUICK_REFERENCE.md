# Netflix Extension Development - Quick Reference Guide

**Last Updated**: November 19, 2025

This is a quick lookup guide for common Netflix extension development tasks.

---

## Selector Quick Reference

### By Use Case

#### "I need to find the title of a video"

```javascript
// On Browse Page
document.querySelector("[data-uia='video-card']")
  .querySelector("[data-uia='video-title']").textContent;

// On Detail Modal
document.querySelector("[role='dialog']")
  .querySelector("[data-uia='video-title']").textContent;

// On Player Page
document.querySelector("[data-uia='video-title']").textContent;
```

#### "I need to detect when a modal appears"

```javascript
const modal = document.querySelector("[role='dialog']");
if (modal && modal.offsetParent !== null) {
  // Modal is visible
}
```

#### "I need all video cards on current page"

```javascript
document.querySelectorAll("[data-uia='video-card']");
```

#### "I need to wait for content to load"

```javascript
async function waitFor(selector, timeout = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const element = document.querySelector(selector);
    if (element) return element;
    await new Promise(r => setTimeout(r, 100));
  }
  return null;
}

const modal = await waitFor("[role='dialog']");
```

#### "I need to track when a user clicks play"

```javascript
const observer = new MutationObserver(() => {
  if (document.querySelector("[data-uia='player-play-pause']")
    .classList.contains('playing')) {
    console.log('Video started playing');
  }
});

observer.observe(document.body, {
  attributes: true,
  subtree: true,
  attributeFilter: ['class']
});
```

---

## Data Extraction Patterns

### Extract All Visible Titles

```javascript
const titles = Array.from(
  document.querySelectorAll("[data-uia='video-card']")
).map(card => ({
  title: card.getAttribute('aria-label')?.split('|')[0]?.trim(),
  element: card
})).filter(t => t.title);
```

### Extract Title with Year

```javascript
function extractTitleAndYear(element) {
  const ariaLabel = element.getAttribute('aria-label');
  if (!ariaLabel) return null;

  const parts = ariaLabel.split('|');
  const title = parts[0]?.trim();

  // Year is somewhere in the label
  const yearMatch = ariaLabel.match(/\b(19|20)\d{2}\b/);
  const year = yearMatch?.[0];

  return { title, year };
}
```

### Extract Modal Information

```javascript
function extractModalData(modal) {
  return {
    title: modal.querySelector("[data-uia='video-title']")?.textContent,
    description: modal.querySelector("[class*='synopsis']")?.textContent,
    rating: modal.querySelector("[class*='rating']")?.textContent,
    year: modal.textContent.match(/\b(19|20)\d{2}\b/)?.[0],
    runtime: modal.querySelector("[class*='duration']")?.textContent
  };
}
```

### Extract Player Information

```javascript
function extractPlayerData() {
  return {
    title: document.querySelector("[data-uia='video-title']")?.textContent,
    isPaused: !document.querySelector("[data-uia='player-play-pause']")
      ?.classList.contains('playing'),
    currentTime: document.querySelector('.player-progress-bar')
      ?.getAttribute('aria-valuenow'),
    duration: document.querySelector('.player-progress-bar')
      ?.getAttribute('aria-valuemax')
  };
}
```

---

## MutationObserver Snippets

### Detect New Content

```javascript
const observer = new MutationObserver(() => {
  const cards = document.querySelectorAll("[data-uia='video-card']:not([data-observed])");
  cards.forEach(card => {
    // Mark as observed
    card.setAttribute('data-observed', 'true');

    // Process new card
    const title = extractTitle(card);
    console.log('New card found:', title);
  });
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});
```

### Debounced Extraction

```javascript
let debounceTimer;
const observer = new MutationObserver(() => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    extractContent(); // Runs after mutations settle
  }, 100);
});
```

### Watch Specific Element

```javascript
const modal = document.querySelector("[role='dialog']");
const observer = new MutationObserver((mutations) => {
  mutations.forEach(m => {
    if (m.attributeName === 'class') {
      console.log('Modal class changed');
    }
  });
});

observer.observe(modal, {
  attributes: true,
  attributeFilter: ['class', 'style']
});
```

### Resource-Conscious Observer

```javascript
const observer = new MutationObserver(mutations => {
  // Only process meaningful changes
  const relevant = mutations.filter(m => {
    // Ignore style-only changes
    if (m.attributeName === 'style') return false;
    // Ignore whitespace text nodes
    if (m.type === 'characterData' &&
        m.target.textContent.trim() === '') return false;
    return true;
  });

  if (relevant.length > 0) {
    processChanges(relevant);
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['class', 'aria-expanded'],
  characterData: false
});
```

---

## UI Injection Patterns

### Inject Button

```javascript
const button = document.createElement('button');
button.textContent = 'My Button';
button.style.cssText = `
  background: linear-gradient(135deg, #e50914, #831010);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
`;

// Find safe injection point
const controls = document.querySelector('.player-controls');
if (controls) {
  controls.appendChild(button);
}
```

### Inject Toast Notification

```javascript
function showToast(message) {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: rgba(0, 0, 0, 0.9);
    color: white;
    padding: 12px 16px;
    border-radius: 4px;
    z-index: 10000;
    border-left: 3px solid #e50914;
  `;
  toast.textContent = message;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
```

### Persistent UI Element (Re-injects on Remove)

```javascript
function makePersistent(parentSelector, createElementFn) {
  let element = createElementFn();
  const parent = document.querySelector(parentSelector);

  if (parent) {
    parent.appendChild(element);
  }

  // Watch for removal
  const observer = new MutationObserver(() => {
    if (!document.contains(element)) {
      element = createElementFn();
      const newParent = document.querySelector(parentSelector);
      if (newParent) {
        newParent.appendChild(element);
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}
```

---

## Chrome API Patterns

### Message Passing

```javascript
// content.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_PAGE_TITLE') {
    const title = document.querySelector("[data-uia='video-title']")?.textContent;
    sendResponse({ title });
  }
});

// background.js
chrome.runtime.sendMessage(
  { type: 'GET_PAGE_TITLE' },
  (response) => {
    console.log('Title:', response.title);
  }
);
```

### Storage API

```javascript
// Save
chrome.storage.local.set({
  'netflix-titles': ['Title 1', 'Title 2']
});

// Load
chrome.storage.local.get(['netflix-titles'], (result) => {
  console.log(result['netflix-titles']);
});

// Clear
chrome.storage.local.clear();
```

### Tab Communication

```javascript
// Get current tab
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tabId = tabs[0].id;

  // Send message to tab
  chrome.tabs.sendMessage(tabId, { type: 'ACTION' }, (response) => {
    console.log('Response:', response);
  });
});
```

---

## Common Mistakes and Fixes

### Mistake 1: Querying before element exists

```javascript
// WRONG
const title = document.querySelector("[data-uia='video-title']")?.textContent;
// Might be null if modal not open yet

// RIGHT
async function getTitle() {
  const start = Date.now();
  while (Date.now() - start < 5000) {
    const title = document.querySelector("[data-uia='video-title']")?.textContent;
    if (title) return title;
    await new Promise(r => setTimeout(r, 100));
  }
  return null;
}
```

### Mistake 2: Using generic selectors

```javascript
// WRONG - Too generic, breaks easily
document.querySelector('.row .tile h4');

// RIGHT - Specific and stable
document.querySelector("[data-uia='video-card'] [data-uia='video-title']");
```

### Mistake 3: Not debouncing mutations

```javascript
// WRONG - Called 1000+ times per second
new MutationObserver(() => {
  document.querySelectorAll("[data-uia='video-card']"); // Expensive!
}).observe(document.body, { childList: true, subtree: true });

// RIGHT - Batched and debounced
let timer;
new MutationObserver(() => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    document.querySelectorAll("[data-uia='video-card']");
  }, 100);
}).observe(document.body, { childList: true, subtree: true });
```

### Mistake 4: Not handling content script isolation

```javascript
// WRONG - Will fail with "netflix is not defined"
try {
  const api = window.netflix.appContext.state.playerApp.getAPI();
} catch (e) {
  console.error('Failed:', e); // Happens every time
}

// RIGHT - Use DOM only
const title = document.querySelector("[data-uia='video-title']")?.textContent;
```

### Mistake 5: Injecting into React-managed DOM

```javascript
// WRONG - Gets removed by React re-render
const card = document.querySelector("[data-uia='video-card']");
const badge = document.createElement('div');
card.appendChild(badge); // Badge removed next render

// RIGHT - Create dedicated container
const container = document.createElement('div');
container.id = 'my-extension-ui';
document.body.appendChild(container);
badge.appendChild(document.createElement('div')); // Won't be removed
```

---

## Testing Checklist

### Before Deployment

```
[ ] Selectors tested on current Netflix version
[ ] MutationObserver doesn't cause lag (DevTools Performance tab)
[ ] Title extraction works on browse page
[ ] Title extraction works on detail modal
[ ] Title extraction works on player page
[ ] Injected UI elements don't break layout
[ ] No errors in console
[ ] Memory usage stable (no leaks)
[ ] CPU usage < 5% idle
[ ] Works after Netflix updates (test new selectors)
[ ] Tested on multiple Netflix regions if possible
[ ] Handles missing elements gracefully
[ ] Cleanup code removes observers
```

---

## Debugging Tips

### Check if selector works

```javascript
// In console:
document.querySelector("[data-uia='video-title']") // Should return element
document.querySelector("[data-uia='video-title']")?.textContent // Should show title
```

### Check observer is running

```javascript
// Add logging
const observer = new MutationObserver((mutations) => {
  console.log(`Mutations detected: ${mutations.length}`);
});
observer.observe(document.body, { childList: true, subtree: true });
```

### Check if element is visible

```javascript
const element = document.querySelector("[role='dialog']");
const isVisible = element && element.offsetParent !== null;
console.log('Modal visible:', isVisible);
```

### Check CSS calculation

```javascript
const element = document.querySelector("[role='dialog']");
const style = window.getComputedStyle(element);
console.log('Display:', style.display); // Should not be 'none'
console.log('Visibility:', style.visibility);
console.log('Z-index:', style.zIndex);
```

### Profile performance

```javascript
// In console:
performance.mark('start');
// ... your code
performance.mark('end');
performance.measure('test', 'start', 'end');
performance.getEntriesByName('test')[0].duration; // Time in ms
```

---

## Netflix Region Differences

### Check Current Region

```javascript
const region = document.documentElement.lang ||
               navigator.language ||
               'en-US';
console.log('Region:', region);
```

### Adjust for Region

```javascript
function getTitleSelector() {
  const region = document.documentElement.lang;

  // Most regions
  const defaults = "[data-uia='video-title']";

  // Adjust for specific regions if needed
  const regional = {
    'ja': "[data-uia='video-title-ja']", // Example
    'ar': "[data-uia='video-title-rtl']", // RTL regions
  };

  return regional[region] || defaults;
}
```

---

## Performance Optimization Checklist

```
[ ] MutationObserver configured with attributeFilter
[ ] Observer debounced (100-200ms delay)
[ ] DOM queries batched, not in loops
[ ] No polling (use observers instead)
[ ] No global references to DOM elements
[ ] Unused observers disconnected
[ ] Event listeners removed on cleanup
[ ] No memory leaks (Chrome DevTools memory profiler)
[ ] CSS animations use GPU (transform, opacity)
[ ] Injected styles minified
[ ] No excessive logging
```

---

## Quick Manifest Template

```json
{
  "manifest_version": 3,
  "name": "Netflix Extension",
  "version": "1.0.0",
  "permissions": ["activeTab", "scripting", "storage"],
  "host_permissions": ["*://*.netflix.com/*"],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [{
    "matches": ["*://*.netflix.com/*"],
    "js": ["content.js"],
    "run_at": "document_start"
  }],
  "action": {
    "default_title": "Netflix Extension"
  }
}
```

---

## One-Liner Utilities

```javascript
// Get all titles on page
Array.from(document.querySelectorAll("[data-uia='video-card']"))
  .map(c => c.getAttribute('aria-label')?.split('|')[0]?.trim());

// Check if on player page
window.location.pathname.includes('/watch');

// Check if modal open
!!document.querySelector("[role='dialog']");

// Get modal title
document.querySelector("[role='dialog'] [data-uia='video-title']")?.textContent;

// Wait for element in one line (callback-based)
const observer = new MutationObserver(() => {
  const elem = document.querySelector(selector);
  if (elem) { observer.disconnect(); callback(elem); }
});
observer.observe(document.body, { childList: true, subtree: true });

// Extract year from any element
element.textContent.match(/\b(19|20)\d{2}\b/)?.[0];

// Check element visibility
element && element.offsetParent !== null;

// Remove all extension elements
document.querySelectorAll('[data-extension-element]').forEach(e => e.remove());

// Log all mutations to console
new MutationObserver(m => console.table(m)).observe(document.body, { childList: true, subtree: true });
```

---

## Emergency Cleanup

If your extension is causing issues:

```javascript
// Run this in console to clean up
(function cleanup() {
  // Disconnect all observers
  window.observers?.forEach(o => o.disconnect());

  // Remove injected elements
  document.querySelectorAll('[data-extension-element]').forEach(e => e.remove());

  // Remove styles
  document.getElementById('extension-styles')?.remove();

  // Clear storage
  chrome.storage.local.clear();

  console.log('Cleanup complete');
})();
```

---

## Resources

- Full guide: `NETFLIX_DOM_EXTENSION_GUIDE.md`
- Code examples: `NETFLIX_EXTENSION_EXAMPLES.md`
- Research summary: `RESEARCH_SUMMARY.md`

---

**Quick Reference Version**: 1.0
**Last Updated**: November 19, 2025
**For Latest**: See full guide documents
