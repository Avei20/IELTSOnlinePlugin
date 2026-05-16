# IELTSPlugin implementation plan

## Goal
Build a Chrome Extension that improves IELTS training on IELTS Online Tests by scraping practice result data, using platform scores for Reading/Listening, using Gemini AI for missing Writing/Speaking scores, and combining all four IELTS bands.

## Target pages
- Practice history: `https://ieltsonlinetests.com/account/practice-test-history`.
- Writing result pages: URLs matching `/wot/result/`.
- Reading, Listening, Speaking result pages: inspect each page type with Playwright before implementing selectors.

## Confirmed Writing result data from example
Example URL: `https://ieltsonlinetests.com/wot/result/writing-practice-test-1-2903539`.

Task 1 question: process diagram about how ethanol fuel is produced from corn; minimum 150 words.
Task 1 answer: user describes storing corn, milling, cooking for 4 hours, fermenting for 48 hours, separating liquid and solid by-product, purifying ethanol for 5 hours, then storing/transporting.

Task 2 question: some people think physical strength is important for success in sport, while others think mental strength is more important; discuss both views and give own opinion; minimum 250 words.
Task 2 answer: user discusses both physical and mental strength, emphasizing mental strength in competition contexts.

## Architecture
1. Content scripts scrape visible result/history data from IELTS Online Tests pages.
2. Content scripts normalize scraped data into typed objects.
3. Content scripts send data to the background service worker via `chrome.runtime.sendMessage`.
4. Background service worker calls Gemini for Writing/Speaking scoring only.
5. Background service worker combines Gemini scores with platform Reading/Listening scores.
6. Popup/dashboard reads from `chrome.storage.local` and displays bands, feedback, weaknesses, and action plan.

## Suggested file structure
```txt
IELTSPlugin/
  manifest.json
  AGENT.md
  src/
    content/
      historyScraper.ts
      writingScraper.ts
      speakingScraper.ts
    background/
      geminiScorer.ts
      scoreCombiner.ts
    popup/
      popup.html
      popup.ts
    shared/
      types.ts
      ieltsMath.ts
```

## Data model
- `PracticeAttempt`: result type, title, result URL, date, optional platform band.
- `WritingResult`: URL, title, Task 1 question/answer, Task 2 question/answer.
- `SpeakingResult`: parts, questions, transcript or audio URL.
- `ObjectiveResult`: Reading/Listening platform score, raw score if available.
- `AiIeltsScore`: overallBand, criterion bands, strengths, weaknesses, corrections, actionPlan, confidence.
- `CombinedIeltsScore`: listening, reading, writing, speaking, overall, and source per skill.

## Scoring rules
- Round IELTS bands with `Math.round(score * 2) / 2`.
- Writing Task 1 criteria: Task Achievement, Coherence and Cohesion, Lexical Resource, Grammatical Range and Accuracy.
- Writing Task 2 criteria: Task Response, Coherence and Cohesion, Lexical Resource, Grammatical Range and Accuracy.
- Writing final band: `roundToNearestHalf((task1Band + task2Band * 2) / 3)`.
- Speaking criteria: Fluency and Coherence, Lexical Resource, Grammatical Range and Accuracy, Pronunciation.
- Speaking final band: average four criteria, round to nearest half.
- Overall IELTS band: average Listening, Reading, Writing, Speaking, round to nearest half.
- Missing scores must remain unavailable; never treat missing as zero.

## Gemini implementation notes
- Use Gemini structured JSON output with a schema.
- Validate parsed JSON before using it.
- Use deterministic rubric-based prompts.
- Do not hardcode API keys.
- For personal local use, store the Gemini API key in `chrome.storage.local`.
- For distribution, use a backend proxy instead of exposing an API key in the extension.

## Debugging behavior
Before code fixes for scraper/scoring failures:
1. Reflect on 5-7 possible sources.
2. Reduce to 1-2 likely causes.
3. Add concise logs to validate assumptions.
4. Implement the smallest fix after evidence.

Recommended log prefix: `[IELTSPlugin]`.

Useful logs:
- Current URL.
- Detected page/result type.
- Extracted section lengths.
- Platform score extraction result.
- Gemini raw response in development only.
- Parsed Gemini score.
- Combined score result.

## Validation
- Use Playwright/browser inspection for actual IELTS Online Tests pages.
- Test Chrome extension manually as unpacked extension.
- Run lint/test/build commands if package tooling exists.
- Confirm no secrets are committed.
