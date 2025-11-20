# Chrome Extension Manifest V3 - Quick Reference Guide

**Last Updated:** November 19, 2025

Quick lookup for common tasks and best practices.

---

## Essential Manifest Fields

```json
{
  "manifest_version": 3,
  "name": "Extension Name (max 75 chars)",
  "version": "1.0.0",
  "description": "Brief description (max 132 chars)",
  "icons": {
    "16": "images/icon-16.png",
    "48": "images/icon-48.png",
    "128": "images/icon-128.png"
  }
}
```

---

## Permissions Cheat Sheet

### API Permissions (No warnings)
```json
"permissions": [
  "storage",           // Chrome storage API
  "scripting",        // Dynamic script injection
  "contextMenus",     // Right-click menus
  "alarms",          // Scheduled tasks (Chrome 120+: min 30s)
  "offscreen"        // DOM access for service workers
]
```

### Host Permissions (May trigger warnings)
```json
"host_permissions": [
  "https://*.netflix.com/*",     // Netflix and subdomains
  "https://www.omdbapi.com/*",   // Specific domain
  "*://mail.google.com/*",       // HTTP and HTTPS
  "file:///path/*"               // Local files (requires user approval)
]
```

### Optional Runtime Permissions
```json
"optional_permissions": ["tabs"],
"optional_host_permissions": ["https://*.example.com/*"]

// Then request in code:
chrome.permissions.request({
  permissions: ["tabs"],
  origins: ["https://*.example.com/*"]
}, (granted) => {
  if (granted) console.log('Permissions granted');
});
```

### Low-Impact Permissions (No warning)
- `storage`
- `scripting`
- `contextMenus`
- `alarms` (Chrome 120+)
- `offscreen`
- `i18n`
- `runtime`

---

## Match Pattern Syntax

```
<scheme>://<host>/<path>

https://*.netflix.com/*         Netflix + all subdomains
https://www.omdbapi.com/        Exact domain
http://127.0.0.1/*              Localhost
file:///path/*                  Local files
*://example.com/*               HTTP or HTTPS
<all_urls>                      All URLs (⚠ triggers review)
```

---

## Service Worker Template

```javascript
// Register listeners at TOP LEVEL (synchronously)
console.log('Service worker loading');

chrome.runtime.onInstalled.addListener(handleInstall);
chrome.runtime.onMessage.addListener(handleMessage);

async function handleInstall(details) {
  console.log('Installed:', details.reason);
}

async function handleMessage(request, sender, sendResponse) {
  try {
    const result = await someAsyncTask();
    sendResponse({ success: true, data: result });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
  return true;  // Keep channel open for async response
}
```

**Key Rules:**
- Register ALL listeners synchronously (top level)
- Don't use `setTimeout`/`setInterval` - use `chrome.alarms`
- Store data in `chrome.storage`, not global variables
- Return `true` if using async/await in message handler
- Service worker unloads after 30 seconds inactivity

---

## Content Script Injection Methods

### 1. Static (Declarative) - Auto-runs

```json
{
  "content_scripts": [
    {
      "matches": ["https://www.netflix.com/*"],
      "js": ["content-script.js"],
      "run_at": "document_idle"
    }
  ]
}
```

### 2. Dynamic (On Demand) - User gesture required

```javascript
// In service worker
chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["content-script.js"]
  });
});
```

### 3. Register at Runtime

```javascript
// Service worker
chrome.scripting.registerContentScripts([{
  id: "my-script",
  js: ["content-script.js"],
  matches: ["*://netflix.com/*"],
  persistAcrossSessions: false
}]);
```

---

## Content Script Run Timing

| Timing | When | Use Case |
|--------|------|----------|
| `document_start` | Before DOM | Monitor early events |
| `document_end` | After DOM, before load | Fast DOM manipulation |
| `document_idle` | After onload (default) | Safe general-purpose |

---

## Messaging Patterns

### One-Time Request-Response
```javascript
// Send from content script
chrome.runtime.sendMessage({ type: 'GET_DATA' }, (response) => {
  console.log(response);
});

// Listen in service worker
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_DATA') {
    // Sync response
    sendResponse({ data: 'value' });
    // OR async response
    asyncTask().then(result => sendResponse({ data: result }));
    return true;  // Keep channel open
  }
});
```

### Long-Lived Connection
```javascript
// Content script
const port = chrome.runtime.connect({ name: 'channel-name' });
port.postMessage({ action: 'start' });
port.onMessage.addListener((msg) => console.log(msg));

// Service worker
chrome.runtime.onConnect.addListener((port) => {
  port.onMessage.addListener((msg) => {
    port.postMessage({ response: 'data' });
  });
});
```

---

## Storage API Quick Reference

```javascript
// Save
chrome.storage.local.set({ key: 'value' });
chrome.storage.sync.set({ key: 'value' });  // Syncs across devices

// Get
const result = await chrome.storage.local.get('key');
const all = await chrome.storage.local.get();

// Remove
chrome.storage.local.remove(['key1', 'key2']);

// Clear
chrome.storage.local.clear();

// Quota
chrome.storage.local.getBytesInUse((bytes) => {
  console.log(`Using ${bytes} bytes`);
});

// Listen for changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  console.log(`${areaName} changed:`, changes);
});
```

**Storage Areas:**
- `local` - Persists, not synced (larger quota)
- `sync` - Persists, synced to user account
- `session` - Per-tab, cleared on tab close

---

## Alarms API (for background tasks)

```javascript
// Create alarm (fires repeatedly)
chrome.alarms.create('my-alarm', { periodInMinutes: 5 });

// Create one-time alarm
chrome.alarms.create('one-time', { delayInMinutes: 2 });

// Listen for alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'my-alarm') {
    doTask();
  }
});

// Clear alarm
chrome.alarms.clear('my-alarm');

// Get all alarms
const alarms = await chrome.alarms.getAll();

// Minimum: 30 seconds (Chrome 120+), 1 minute otherwise
```

---

## Offscreen Documents (For DOM Access in Service Worker)

```javascript
// Create
chrome.offscreen.createDocument({
  url: 'offscreen.html',
  reasons: ['DOM_PARSER'],
  justification: 'Parse HTML from API response'
});

// Send message
chrome.runtime.sendMessage({
  type: 'PARSE_HTML',
  html: '<div>content</div>'
});

// Cleanup (in offscreen.html script)
if (/* done with work */) {
  chrome.offscreen.closeDocument();
}
```

**Valid Reasons:**
- `DOM_PARSER`, `DOM_SCRAPING`, `BLOBS`, `CLIPBOARD`, `IFRAME_SCRIPTING`, `LOCAL_STORAGE`, `WORKERS`, `WEB_RTC`, `AUDIO_PLAYBACK`, `USER_MEDIA`, `DISPLAY_MEDIA`, `GEOLOCATION`, `MATCH_MEDIA`, `BATTERY_STATUS`, `TESTING`

---

## Content Security Policy (CSP)

### Default (No custom CSP needed)
```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self';"
  }
}
```

### Rules
- ✓ Local scripts only
- ✓ No inline `<script>` tags
- ✓ No remote URLs (CDNs)
- ✓ No `eval()` or `new Function()`
- ✓ WasmUnsafeEval allowed

### Load External Resources
```javascript
// BAD: Won't work
fetch('https://cdn.example.com/lib.js');

// GOOD: Copy to extension
fetch(chrome.runtime.getURL('lib/library.js'));

// GOOD: For web pages, use web_accessible_resources
```

---

## Web Accessible Resources

```json
{
  "web_accessible_resources": [
    {
      "resources": ["injected.js", "styles.css"],
      "matches": ["https://www.netflix.com/*"]
    }
  ]
}
```

Access from web page:
```javascript
const url = chrome.runtime.getURL('injected.js');
fetch(url);
```

---

## activeTab Permission (Recommended)

Instead of broad host permissions:

```json
{
  "permissions": ["activeTab", "scripting"]
}
```

**What activeTab gives:**
- Temporary host permission for current tab
- Access revoked on navigation
- No installation warning
- Only active when extension invoked

**When activated:**
- User clicks extension icon
- User selects context menu item
- User uses keyboard shortcut
- User accepts omnibox suggestion

---

## Debugging

### Service Worker Logs
1. Go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Inspect" under "Service Worker"
4. View console in DevTools

### Content Script Logs
1. Open Netflix page
2. Right-click → "Inspect"
3. Switch to Console tab
4. Look for content script logs

### Common Issues

**Service Worker keeps restarting:**
- Check for infinite loops in event handlers
- Ensure async work is properly awaited
- Verify listeners are registered synchronously

**Content script not injecting:**
- Check match pattern syntax
- Verify permissions include host
- Check browser console for errors

**Messages not received:**
- Ensure listener registered before sending
- Return `true` if response is async
- Check `chrome.runtime.lastError`

---

## Extension Communication Flow

```
User Action (button click, tab update, etc.)
    ↓
chrome.action.onClicked / other event
    ↓
Service Worker
    ↓
chrome.runtime.sendMessage() ↔ chrome.runtime.onMessage
    ↓
Content Script
    ↓
Manipulate Netflix page DOM
```

---

## File Size Limits

| Item | Limit | Impact |
|------|-------|--------|
| Extension | ~50MB | Web Store upload limit |
| Manifest | ~2MB | Manifest parsing limit |
| Service worker | No limit | Performance concern |
| Storage quota | 10MB (sync), 10MB (local) | Store data efficiently |

---

## Performance Best Practices

### Service Worker
```javascript
// BAD: Blocks service worker
for (let i = 0; i < 1000000; i++) {
  heavyCalculation();
}

// GOOD: Quick handler, defer work
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.quick) {
    sendResponse({ result: 'fast' });  // Don't keep alive
  } else {
    asyncWork().then(r => sendResponse(r));
    return true;  // Keep alive only if needed
  }
});
```

### Content Script
```javascript
// BAD: Multiple layout recalculations
movies.forEach(movie => {
  document.body.appendChild(createElement(movie));
});

// GOOD: Batch DOM updates
const fragment = document.createDocumentFragment();
movies.forEach(movie => {
  fragment.appendChild(createElement(movie));
});
document.body.appendChild(fragment);
```

### Storage
```javascript
// BAD: Multiple calls
movies.forEach(movie => {
  chrome.storage.local.set({ [movie.id]: movie });
});

// GOOD: Single batch call
const batch = {};
movies.forEach(movie => {
  batch[movie.id] = movie;
});
chrome.storage.local.set(batch);
```

---

## Common Mistakes

| Mistake | Problem | Solution |
|---------|---------|----------|
| Global variables in service worker | Lost when unloads | Use `chrome.storage` |
| Inline scripts in HTML | CSP violation | Load from external file |
| `setTimeout` in service worker | Unreliable | Use `chrome.alarms` |
| Async listeners not returned true | Message lost | Return `true` in handler |
| Unregistered listeners | Events missed | Register synchronously |
| Hardcoded API keys | Security risk | Use environment variables |
| No error handling | Silent failures | Wrap in try-catch |
| Requesting broad permissions | User distrust | Use `activeTab` when possible |

---

## Security Checklist

- [ ] No hardcoded secrets (API keys, tokens)
- [ ] All external data sanitized/escaped
- [ ] HTTPS only for external APIs
- [ ] Message validation in handlers
- [ ] Sender verification for important messages
- [ ] No remote code loading (CSP enforces this)
- [ ] Minimal permissions requested
- [ ] Privacy policy disclosed
- [ ] No tracking/telemetry without consent
- [ ] Regular security updates

---

## Chrome Version Support

Add to manifest to target specific Chrome:

```json
{
  "minimum_chrome_version": "120"
}
```

**Important Version Features:**
- Chrome 133+ - Enhanced host access requests
- Chrome 120+ - Alarms min 30s, improved service workers
- Chrome 118+ - Debugger keeps service workers alive
- Chrome 116+ - WebSocket extends lifetime, getContexts()
- Chrome 109+ - Offscreen messages reset timer
- Chrome 105+ - Native messaging keeps service worker alive
- Chrome 88+ - MV3 launched

---

## Resources

- **Official:** https://developer.chrome.com/docs/extensions/
- **Samples:** https://github.com/GoogleChrome/chrome-extensions-samples
- **Migration:** https://developer.chrome.com/docs/extensions/develop/migrate
- **API Reference:** https://developer.chrome.com/docs/extensions/reference/

---

## Quick Template

```json
{
  "manifest_version": 3,
  "name": "My Extension",
  "version": "1.0.0",
  "description": "What it does",
  "permissions": ["storage", "scripting"],
  "host_permissions": ["https://example.com/*"],
  "background": { "service_worker": "sw.js" },
  "content_scripts": [{
    "matches": ["https://example.com/*"],
    "js": ["content.js"]
  }],
  "action": { "default_popup": "popup.html" },
  "icons": { "128": "icon.png" }
}
```

---

**For complete details, see:**
- `/resources/research/MANIFEST_V3_2025_RESEARCH.md` - Comprehensive guide
- `/resources/research/MV3_IMPLEMENTATION_TEMPLATES.md` - Code templates
