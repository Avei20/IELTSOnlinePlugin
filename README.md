# IELTS Plugin

A Chrome Extension that enhances IELTS practice on [IELTS Online Tests](https://ieltsonlinetests.com/) by providing AI-powered scoring and feedback for Writing and Speaking tests using Google's Gemini AI.

## Features

- **Automatic Data Extraction**: Scrapes test results from IELTS Online Tests
- **Platform Score Integration**: Uses existing Reading and Listening scores from the platform
- **AI-Powered Scoring**: Uses Gemini AI to score Writing and Speaking tests based on official IELTS criteria
- **Combined IELTS Band**: Calculates overall IELTS band from all four skills
- **Detailed Feedback**: Provides strengths, weaknesses, corrections, and action plans
- **Privacy-Focused**: All data stored locally in your browser

## Installation

### Prerequisites

- Google Chrome browser
- A Gemini API key (get one from [Google AI Studio](https://makersuite.google.com/app/apikey))

### Steps

1. **Clone or download this repository**

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the extension**
   ```bash
   npm run build
   ```

4. **Add placeholder icons** (optional, for development)
   - Create a `icons` directory in the project root
   - Add icon files: `icon16.png`, `icon48.png`, `icon128.png`
   - Or use any placeholder images for testing

5. **Load the extension in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right corner)
   - Click "Load unpacked"
   - Select the `dist` folder from this project

6. **Configure your Gemini API key**
   - Click the extension icon in Chrome toolbar
   - Enter your Gemini API key in the popup
   - Click "Save API Key"

## Usage

1. **Take a test on IELTS Online Tests**
   - Go to [https://ieltsonlinetests.com/](https://ieltsonlinetests.com/)
   - Complete a Reading, Listening, Writing, or Speaking test
   - Navigate to the result page

2. **Automatic scraping**
   - The extension automatically detects result pages
   - For Reading/Listening: Platform scores are captured immediately
   - For Writing/Speaking: Content is sent to Gemini AI for scoring

3. **View your scores**
   - Click the extension icon to open the popup
   - View your combined IELTS band and individual skill scores
   - Read AI-generated feedback, corrections, and action plans

4. **Manage scores**
   - Click "Refresh Scores" to reload current scores
   - Click "Clear All" to reset all stored scores

## Architecture

```
IELTSPlugin/
├── manifest.json              # Chrome extension manifest
├── src/
│   ├── content/              # Content scripts (run on web pages)
│   │   ├── contentScript.ts  # Main content script coordinator
│   │   ├── writingScraper.ts # Writing result scraper
│   │   ├── speakingScraper.ts # Speaking result scraper
│   │   └── objectiveScraper.ts # Reading/Listening scraper
│   ├── background/           # Background service worker
│   │   ├── service-worker.ts # Message handler
│   │   ├── geminiScorer.ts   # Gemini AI integration
│   │   └── scoreCombiner.ts  # Score storage and combination
│   ├── popup/                # Extension popup UI
│   │   ├── popup.html        # Popup interface
│   │   └── popup.ts          # Popup logic
│   └── shared/               # Shared utilities
│       ├── types.ts          # TypeScript type definitions
│       └── ieltsMath.ts      # IELTS band calculations
├── package.json
├── tsconfig.json
└── README.md
```

## IELTS Scoring Rules

The extension follows official IELTS scoring rules:

- **Writing**: `(Task1 + Task2 × 2) / 3`, rounded to nearest 0.5
- **Speaking**: Average of 4 criteria, rounded to nearest 0.5
- **Overall Band**: Average of all 4 skills, rounded to nearest 0.5
- Missing scores are excluded from calculations (never treated as zero)

## Development

### Build commands

```bash
# Build once
npm run build

# Watch mode (rebuild on file changes)
npm run watch

# Clean build directory
npm run clean
```

### Testing

1. Make changes to source files
2. Run `npm run build`
3. Go to `chrome://extensions/`
4. Click the refresh icon on the IELTS Plugin card
5. Test on IELTS Online Tests result pages

### Debugging

- Open Chrome DevTools on the extension popup (right-click popup → Inspect)
- View background service worker logs: `chrome://extensions/` → IELTS Plugin → "service worker" link
- View content script logs: Open DevTools on any IELTS Online Tests page
- All logs are prefixed with `[IELTSPlugin]`

## Privacy & Security

- **API Key Storage**: Your Gemini API key is stored locally in Chrome's storage (never sent to third parties)
- **Data Storage**: All scores and feedback are stored locally in your browser
- **No External Servers**: The extension only communicates with:
  - IELTS Online Tests (to scrape data)
  - Google Gemini API (to score Writing/Speaking)
- **No Tracking**: No analytics or tracking of any kind

## Limitations

- Only works on [ieltsonlinetests.com](https://ieltsonlinetests.com/)
- Requires a Gemini API key (free tier available)
- AI scoring is approximate and should not replace official IELTS assessment
- Scraping may break if the website structure changes

## Troubleshooting

### Extension not detecting result pages

1. Check browser console for `[IELTSPlugin]` logs
2. Verify you're on a result page (URL should contain `/result/`)
3. Try refreshing the page
4. Check that the extension is enabled

### AI scoring not working

1. Verify your Gemini API key is saved correctly
2. Check the background service worker logs for errors
3. Ensure you have internet connectivity
4. Check Gemini API quota limits

### Scores not appearing in popup

1. Click "Refresh Scores" button
2. Check browser console for errors
3. Try clearing scores and retaking a test

## Future Enhancements

- Support for practice test history page scraping
- Detailed criterion-level band display
- Score history and progress tracking
- Export scores to PDF/CSV
- Support for other IELTS practice platforms

## Contributing

Contributions are welcome! Please ensure:

- Code follows existing style and conventions
- TypeScript types are properly defined
- All features are tested manually
- No secrets are committed to the repository

## License

MIT License - see LICENSE file for details

## Disclaimer

This is an unofficial tool and is not affiliated with, endorsed by, or connected to IELTS, the British Council, IDP Education, or Cambridge Assessment English. IELTS is a registered trademark. AI-generated scores are approximations and should not be considered official IELTS assessments.
