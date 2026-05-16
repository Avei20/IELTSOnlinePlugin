# AGENT.md

## Project behavior

IELTSPlugin is a Chrome Extension project for IELTS Online Tests. Its goal is to extract IELTS practice-test data, use existing platform scores for Reading and Listening, use Gemini AI for missing Writing and Speaking scores, then calculate a combined IELTS band and training feedback.

Target site:

- `https://ieltsonlinetests.com/`

Important target pages:

- Practice history: `https://ieltsonlinetests.com/account/practice-test-history`
- Writing result pages: URLs matching `/wot/result/`
- Reading, Listening, and Speaking result pages: inspect each page type with Playwright before implementing selectors.

Use Playwright/browser inspection before changing scraper behavior. Do not assume DOM structure across page types.

## Confirmed Writing result example

Example URL:

`https://ieltsonlinetests.com/wot/result/writing-practice-test-1-2903539`

Extracted data:

- Task 1 question: process diagram about how ethanol fuel is produced from corn; minimum 150 words.
- Task 1 answer: user describes storing corn, milling, cooking for 4 hours, fermenting for 48 hours, separating liquid and solid by-product, purifying ethanol for 5 hours, then storing/transporting.
- Task 2 question: physical strength vs mental strength for success in sport; discuss both views and give own opinion; minimum 250 words.
- Task 2 answer: user discusses both physical and mental strength, emphasizing mental strength in competition contexts.

## Architecture plan

1. Content scripts scrape IELTS Online Tests pages.
2. Content scripts normalize data into typed objects.
3. Content scripts send data to the background service worker with `chrome.runtime.sendMessage`.
4. Background service worker calls Gemini only for Writing and Speaking scoring.
5. Background service worker combines AI Writing/Speaking scores with platform Reading/Listening scores.
6. Popup/dashboard reads stored results and shows bands, weaknesses, corrections, and action plan.

Do not call Gemini from page context.

## Data model direction

Use explicit TypeScript types for normalized data:

- `PracticeAttempt`: result type, title, result URL, date, optional platform band.
- `WritingResult`: URL, title, Task 1 question/answer, Task 2 question/answer.
- `SpeakingResult`: speaking parts, questions, transcript or audio URL.
- `ObjectiveResult`: Reading/Listening platform score and raw score if available.
- `AiIeltsScore`: overall band, criteria bands, strengths, weaknesses, corrections, action plan, confidence.
- `CombinedIeltsScore`: Listening, Reading, Writing, Speaking, overall, and source per skill.

Missing scores must remain unavailable. Never treat missing scores as zero.

## IELTS scoring rules

Round bands with `Math.round(score * 2) / 2`.

Writing final band: `roundToNearestHalf((task1Band + task2Band * 2) / 3)`.

Speaking final band: average Fluency and Coherence, Lexical Resource, Grammatical Range and Accuracy, and Pronunciation, then round to nearest half.

Overall IELTS band: average Listening, Reading, Writing, and Speaking, then round to nearest half.

## Gemini behavior

Use Gemini structured JSON output with a strict schema. Validate parsed JSON before using it.

Do not hardcode Gemini API keys.

- Personal/local extension: store API key in `chrome.storage.local`.
- Distributed extension: use a backend proxy.

Prompting rules:

- Be IELTS-rubric-based.
- Request criterion-level bands.
- Request concise strengths, weaknesses, corrections, and action plan.
- Keep temperature low for consistency.
- Do not use unvalidated free-form model text as score data.

## Debugging behavior

Before implementing scraper or scoring fixes:

1. Consider 5-7 possible sources of the problem.
2. Reduce them to the 1-2 most likely sources.
3. Add focused logs to validate assumptions.
4. Implement the smallest fix after evidence.

Use concise logs with this prefix: `[IELTSPlugin]`.

Useful logs:

- Current URL.
- Detected page/result type.
- Extracted section lengths.
- Platform score extraction result.
- Gemini raw response in development only.
- Parsed Gemini score.
- Combined score result.

## Validation

- Use Playwright/browser inspection against actual IELTS Online Tests pages.
- Test the extension manually as an unpacked Chrome extension.
- Run lint/test/build commands when package tooling exists.
- Confirm no secrets are committed.
