# Development Setup Guide

## Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Build the extension**
   ```bash
   npm run build
   ```

3. **Create icon files** (required before loading in Chrome)
   
   The extension needs three icon sizes. You can:
   
   **Option A: Use online tools**
   - Go to https://www.favicon-generator.org/
   - Upload the `icons/icon.svg` file
   - Download 16x16, 48x48, and 128x128 PNG files
   - Save them as `icon16.png`, `icon48.png`, `icon128.png` in the `icons/` directory
   
   **Option B: Use ImageMagick (if installed)**
   ```bash
   convert icons/icon.svg -resize 16x16 icons/icon16.png
   convert icons/icon.svg -resize 48x48 icons/icon48.png
   convert icons/icon.svg -resize 128x128 icons/icon128.png
   ```
   
   **Option C: Use any 128x128 image**
   - Find or create any PNG image (128x128 pixels)
   - Copy it three times as `icon16.png`, `icon48.png`, `icon128.png`
   - Chrome will resize them automatically

4. **Load in Chrome**
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist/` folder

5. **Get Gemini API Key**
   - Go to https://makersuite.google.com/app/apikey
   - Create a new API key
   - Copy it

6. **Configure the extension**
   - Click the extension icon in Chrome toolbar
   - Paste your Gemini API key
   - Click "Save API Key"

## Testing the Extension

### Test with Writing Result Page

1. Go to https://ieltsonlinetests.com/
2. Navigate to a writing test result page (URL should contain `/wot/result/`)
3. Open Chrome DevTools (F12)
4. Look for `[IELTSPlugin]` logs in the console
5. The extension should automatically scrape the writing data
6. Click the extension icon to see the AI-generated score

### Test with Reading/Listening Result Page

1. Navigate to a reading or listening result page
2. The extension should detect the page type
3. Platform scores should be captured automatically
4. Check the popup to see the scores

### Debugging Tips

- **Content script logs**: Open DevTools on the IELTS Online Tests page
- **Background logs**: Go to `chrome://extensions/`, find IELTS Plugin, click "service worker"
- **Popup logs**: Right-click the extension icon → Inspect
- All logs are prefixed with `[IELTSPlugin]`

## Project Structure

```
IELTSPlugin/
├── src/
│   ├── content/              # Runs on ieltsonlinetests.com pages
│   │   ├── contentScript.ts  # Main coordinator
│   │   ├── writingScraper.ts # Extracts writing Q&A
│   │   ├── speakingScraper.ts # Extracts speaking data
│   │   └── objectiveScraper.ts # Extracts reading/listening scores
│   ├── background/           # Background service worker
│   │   ├── service-worker.ts # Message handler
│   │   ├── geminiScorer.ts   # Calls Gemini API
│   │   └── scoreCombiner.ts  # Stores and combines scores
│   ├── popup/                # Extension popup UI
│   │   ├── popup.html
│   │   └── popup.ts
│   └── shared/               # Shared code
│       ├── types.ts          # TypeScript interfaces
│       └── ieltsMath.ts      # IELTS band calculations
├── manifest.json             # Chrome extension config
├── package.json
├── tsconfig.json
└── README.md
```

## Common Issues

### TypeScript compilation errors

- Make sure you ran `npm install` first
- Check that `@types/chrome` is installed
- Run `npm run clean` and rebuild

### Extension not loading

- Make sure you built the project (`npm run build`)
- Load the `dist/` folder, not the project root
- Check that icon files exist in `dist/icons/`

### Scraping not working

- The website structure may have changed
- Use Playwright to inspect the actual page structure
- Update selectors in the scraper files
- Check console logs for specific errors

### Gemini API errors

- Verify your API key is correct
- Check you haven't exceeded quota limits
- Ensure you have internet connectivity
- Check the background service worker logs

## Next Steps

After basic setup works:

1. **Test on actual IELTS Online Tests pages**
   - The scrapers use generic selectors that may need adjustment
   - Use browser DevTools to inspect the actual page structure
   - Update selectors in scraper files as needed

2. **Use Playwright for inspection** (as per AGENT.md)
   ```bash
   npm install -D playwright
   npx playwright codegen https://ieltsonlinetests.com/wot/result/writing-practice-test-1-2903539
   ```

3. **Refine AI prompts**
   - Test with real writing/speaking samples
   - Adjust prompts in `geminiScorer.ts` for better accuracy
   - Tune temperature and other generation parameters

4. **Add error handling**
   - Handle network failures gracefully
   - Add retry logic for API calls
   - Improve user feedback for errors

## Development Workflow

1. Make changes to TypeScript files
2. Run `npm run build` (or `npm run watch` for auto-rebuild)
3. Go to `chrome://extensions/`
4. Click the refresh icon on the IELTS Plugin card
5. Test on IELTS Online Tests pages
6. Check logs in DevTools

## Production Checklist

Before distributing:

- [ ] Replace placeholder icons with proper branded icons
- [ ] Test on multiple writing/speaking result pages
- [ ] Verify all scrapers work with current website structure
- [ ] Test Gemini API integration thoroughly
- [ ] Add proper error messages for users
- [ ] Consider adding a backend proxy for API key security
- [ ] Add usage analytics (optional, with user consent)
- [ ] Create Chrome Web Store listing materials
- [ ] Write comprehensive user documentation
