# Netflix Ratings Extension - Installation & Testing Guide

## Quick Start (5 Minutes)

### Step 1: Install Dependencies
```bash
cd /workspaces/netflix-extension
npm install
```

**Expected Output**: `added 266 packages` (Jest and dependencies)

---

### Step 2: Run Tests
```bash
npm test
```

**Expected Output**:
```
✓ 32 tests passing
✓ Test Suites: 1 passed
✓ All checks passed
```

---

### Step 3: Load Extension in Chrome

1. **Open Chrome Extensions Page**
   - Navigate to `chrome://extensions/`
   - Or: Menu → More Tools → Extensions

2. **Enable Developer Mode**
   - Toggle the switch in the top-right corner
   - This enables "Load unpacked" button

3. **Load the Extension**
   - Click "Load unpacked" button
   - Navigate to `/workspaces/netflix-extension`
   - Click "Select Folder"

4. **Verify Installation**
   - Extension should appear in the list
   - Name: "Netflix Ratings"
   - Version: 1.0.0
   - Status: ✅ Enabled
   - No errors in the card

**Troubleshooting**:
- If errors appear, check that all files exist
- Verify manifest.json is valid JSON
- Check console for specific error messages

---

### Step 4: Configure API Key

1. **Click Extension Icon**
   - Find the puzzle piece icon in Chrome toolbar
   - Click "Netflix Ratings" extension
   - Popup window opens

2. **Enter API Key**
   - Field label: "OMDB API Key"
   - Default key: `b9bd48a6` (for testing)
   - Or get your own free key at [omdbapi.com](https://www.omdbapi.com/apikey.aspx)

3. **Save Configuration**
   - Click "Save API Key" button
   - Status message: "API key saved successfully!"
   - Button changes to "Saved ✓"

4. **Verify Settings**
   - Cache statistics should show "0" initially
   - All UI elements should be styled correctly

---

### Step 5: Test on Netflix

1. **Navigate to Netflix**
   - Open new tab
   - Go to [netflix.com](https://www.netflix.com)
   - Log in if necessary

2. **Open Developer Console**
   - Press `F12` or `Ctrl+Shift+I` (Windows/Linux)
   - Press `Cmd+Option+I` (Mac)
   - Switch to "Console" tab

3. **Filter Console Logs**
   - In console filter box, type: `Netflix Ratings`
   - You should see logs like:
     ```
     [Netflix Ratings] Content script loaded
     [Netflix Ratings] Initializing content script
     [Netflix Ratings] Setting up MutationObserver
     [Netflix Ratings] Found X title cards
     ```

4. **Browse Netflix Content**
   - Scroll through the homepage
   - Hover over movie/series thumbnails
   - Open detail modals by clicking titles

5. **Verify Rating Badges Appear**
   - Look for black badges on title cards
   - Badges should show: IMDb, MC (Metacritic), RT (Rotten Tomatoes)
   - Example: `IMDb: 8.5/10 | MC: 75/100 | RT: 85%`

6. **Check Console for Activity**
   - Watch for logs showing:
     - Title extraction
     - API requests to OMDB
     - Rating badge injection
   - Example logs:
     ```
     [Netflix Ratings] Extracted title: "Stranger Things"
     [Service Worker] Fetching ratings for: Stranger Things
     [Netflix Ratings] Received ratings: {imdb: {...}, ...}
     [Netflix Ratings] Badge injected successfully
     ```

---

## Detailed Testing Checklist

### Extension Installation ✅
- [ ] Extension loads without errors
- [ ] Icon appears in Chrome toolbar
- [ ] Popup opens when icon clicked
- [ ] No error messages in chrome://extensions/

### Popup Functionality ✅
- [ ] API key input field is visible
- [ ] API key can be entered and saved
- [ ] Success message appears after saving
- [ ] Cache stats display correctly (initially "0")
- [ ] "Clear Cache" button is clickable
- [ ] All UI elements styled correctly (Netflix theme)

### Content Script on Netflix ✅
- [ ] Console shows "[Netflix Ratings] Content script loaded"
- [ ] No JavaScript errors in console
- [ ] Content script detects Netflix page
- [ ] MutationObserver is set up

### Title Detection ✅
- [ ] Titles detected on homepage carousel
- [ ] Titles detected on detail modals
- [ ] Titles detected on "My List" page
- [ ] Titles detected on "Continue Watching" row
- [ ] Console logs show extracted titles

### Rating Badge Display ✅
- [ ] Badges appear on title cards
- [ ] Badges show IMDb rating when available
- [ ] Badges show Metacritic score when available
- [ ] Badges show Rotten Tomatoes rating when available
- [ ] Badges are styled correctly (black background, colored text)
- [ ] Badges positioned correctly (bottom-left of cards)
- [ ] Badges have hover effects

### Service Worker ✅
- [ ] Service worker loads without errors
- [ ] API requests sent to OMDB
- [ ] Responses received and parsed
- [ ] Ratings extracted correctly
- [ ] Cache is used for repeated requests
- [ ] Console logs show service worker activity

### Caching ✅
- [ ] First request fetches from API
- [ ] Second request uses cache (check console)
- [ ] Cache stats update in popup
- [ ] "Clear Cache" button works
- [ ] Cache cleared message appears

### Error Handling ✅
- [ ] Invalid API key shows error
- [ ] Network errors handled gracefully
- [ ] Missing ratings handled (no crash)
- [ ] Console errors are logged with details

---

## Console Log Examples

### Successful Flow
```
[Netflix Ratings] Content script loaded
[Netflix Ratings] Initializing content script
[Netflix Ratings] Processing existing content
[Netflix Ratings] Found 24 title cards
[Netflix Ratings] Processing card 1/24
[Netflix Ratings] Extracting title info from card
[Netflix Ratings] Found title via data-uia: "Stranger Things"
[Netflix Ratings] Cleaned title: "Stranger Things"
[Netflix Ratings] Sending message to service worker: {title: "Stranger Things"}
[Service Worker] Received message: FETCH_RATINGS from tab: 123
[Service Worker] Fetching ratings for: {title: "Stranger Things"}
[Service Worker] Cache miss, fetching from OMDB
[Service Worker] OMDB URL: https://www.omdbapi.com/?apikey=***&t=Stranger%20Things
[Service Worker] Fetch successful
[Service Worker] OMDB response received
[Service Worker] Successfully fetched: Stranger Things (2016)
[Service Worker] Extracting ratings from: Stranger Things
[Service Worker] IMDb rating: 8.7
[Service Worker] Metacritic score: N/A
[Service Worker] Rotten Tomatoes rating: 93%
[Netflix Ratings] Received response from service worker: {success: true, ratings: {...}}
[Netflix Ratings] Injecting rating badge into card
[Netflix Ratings] Badge injected successfully
```

### Cache Hit
```
[Netflix Ratings] Sending message to service worker: {title: "Stranger Things"}
[Service Worker] Received message: FETCH_RATINGS
[Service Worker] Cache hit for: Stranger Things
[Netflix Ratings] Received ratings: {imdb: {...}, rottenTomatoes: {...}}
[Netflix Ratings] Badge injected successfully
```

### Error Scenario
```
[Netflix Ratings] Sending message to service worker: {title: "Unknown Movie 123456"}
[Service Worker] Received message: FETCH_RATINGS
[Service Worker] Cache miss, fetching from OMDB
[Service Worker] OMDB response received
[Service Worker] OMDB API returned error: Movie not found!
[Netflix Ratings] Service worker returned error: No data found
[Netflix Ratings] No ratings available for: Unknown Movie 123456
```

---

## Testing Different Netflix Pages

### Homepage / Browse
- URL: `https://www.netflix.com/browse`
- Expected: Rating badges on carousel items
- Test: Scroll through rows, badges should appear

### Detail Modal
- Action: Click any title to open detail modal
- Expected: Larger badge on modal (top-right)
- Test: Open multiple modals, badges update

### My List
- URL: `https://www.netflix.com/browse/my-list`
- Expected: Badges on all items in My List
- Test: Add items to list, badges appear

### Search Results
- URL: `https://www.netflix.com/search?q=stranger`
- Expected: Badges on search result cards
- Test: Search for titles, verify badges

### Player Page
- Action: Click play on any title
- Expected: Badge may appear on player UI
- Test: Check console for title detection

---

## Performance Testing

### Load Time
- Open Netflix homepage
- Measure time to first badge appearance
- **Expected**: < 2 seconds for first badges

### Scroll Performance
- Scroll quickly through Netflix homepage
- Check if browser becomes sluggish
- **Expected**: Smooth scrolling, no lag

### API Rate Limits
- Browse 20-30 different titles
- Check cache hit rate in console
- **Expected**: Most requests use cache after first fetch

### Memory Usage
- Open Chrome Task Manager (Shift+Esc)
- Find "Netflix Ratings" extension process
- **Expected**: < 10MB memory usage

---

## Common Issues & Solutions

### Issue: Extension Not Loading
**Symptoms**: Extension doesn't appear in chrome://extensions/
**Solutions**:
1. Check file permissions
2. Verify manifest.json syntax
3. Check for missing files
4. Try "Load unpacked" again

### Issue: No Badges Appearing
**Symptoms**: Netflix loads but no rating badges
**Solutions**:
1. Check console for errors
2. Verify API key is saved
3. Clear cache and refresh Netflix
4. Check if content script loaded (look for log)

### Issue: "Invalid API Key" Error
**Symptoms**: Popup shows error message
**Solutions**:
1. Verify API key format (8+ characters)
2. Try default key: `b9bd48a6`
3. Register new key at omdbapi.com
4. Check network connectivity

### Issue: Ratings Not Updating
**Symptoms**: Old ratings persist
**Solutions**:
1. Open popup, click "Clear Cache"
2. Refresh Netflix page
3. Check console for API errors
4. Verify cache timestamp in logs

### Issue: Console Flooded with Logs
**Symptoms**: Too many log messages
**Solutions**:
1. Filter console by "[Netflix Ratings]"
2. Reduce log verbosity (edit source files)
3. Use console log levels (info, warn, error only)

---

## Advanced Testing

### Testing API Failures
1. **Disconnect Internet**
   - Turn off network
   - Browse Netflix
   - Expected: Graceful error messages, retry attempts

2. **Invalid API Key**
   - Enter gibberish in API key field
   - Browse Netflix
   - Expected: Error logged, no crashes

3. **Rate Limit Exceeded**
   - Make 1,000+ requests (hit API limit)
   - Expected: Error message, retry logic activates

### Testing Netflix UI Changes
1. **Switch Netflix Profiles**
   - Change profile, browse content
   - Expected: Badges still work

2. **Different Languages**
   - Change Netflix language
   - Expected: Title extraction still works

3. **Different Regions**
   - Use VPN to change region
   - Expected: Works with regional content

### Testing Edge Cases
1. **Very Long Titles**
   - Find content with long names
   - Expected: Badge doesn't overflow

2. **Special Characters**
   - Titles with accents, symbols
   - Expected: Proper API encoding

3. **Rapid Scrolling**
   - Scroll very fast through Netflix
   - Expected: Debouncing works, no duplicates

---

## Uninstalling

If you need to remove the extension:

1. Go to `chrome://extensions/`
2. Find "Netflix Ratings"
3. Click "Remove"
4. Confirm removal
5. Extension and all data are removed

---

## Next Steps After Testing

1. **Report Issues**
   - Create GitHub issue with:
     - Steps to reproduce
     - Console logs
     - Screenshots
     - Browser version

2. **Request Features**
   - Badge position preferences
   - Additional rating sources
   - UI customization

3. **Contribute**
   - Fix bugs
   - Add features
   - Improve documentation

---

## Support

If you encounter issues:
- Check console logs first
- Review troubleshooting section
- Search existing GitHub issues
- Create new issue with details

---

**Happy Testing!** 🎬🍿

_If all tests pass, the extension is ready for daily use on Netflix._
