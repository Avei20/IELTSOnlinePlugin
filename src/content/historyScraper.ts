import { IeltsTestScoreRow, ResultType } from "../shared/types";
import { calculateOverallBand } from "../shared/ieltsMath";

const LOG_PREFIX = "[IELTSPlugin]";
const SKILL_PATTERN = /_(Writing|Speaking|Listening|Reading)\b/i;

export function isHistoryPage(): boolean {
  const url = window.location.href;
  const isHistory = url.includes("/account/practice-test-history");
  console.log(`${LOG_PREFIX} isHistoryPage: ${isHistory}, URL: ${url}`);
  return isHistory;
}

export function scrapeHistoryTests(): IeltsTestScoreRow[] {
  console.log(`${LOG_PREFIX} Starting grouped history page scrape`);

  const rows = Array.from(document.querySelectorAll("table tbody tr"));
  const grouped = new Map<string, IeltsTestScoreRow>();

  for (const row of rows) {
    const cells = row.querySelectorAll("td");
    if (cells.length < 5) continue;

    const date = cells[0].textContent?.trim() || "";
    const fullTestName = cells[1].textContent?.trim() || "";
    const scoreText = cells[2].textContent?.trim() || "";
    const reviewPath = cells[4].querySelector("a")?.getAttribute("href") || "";
    const skill = getSkill(fullTestName);
    if (!skill) continue;

    const testName = normalizeTestName(fullTestName);
    const id = slugify(testName);
    const reviewUrl = reviewPath
      ? new URL(reviewPath, window.location.origin).href
      : undefined;

    const test = grouped.get(id) || {
      id,
      testName,
      date,
      reviewUrls: {},
      sources: {},
      status: {},
    };

    if (reviewUrl) test.reviewUrls[skill] = reviewUrl;

    const score = parseScore(skill, scoreText);
    if (score !== undefined) {
      test[skill] = score;
      test.sources[skill] = "platform";
      test.status![skill] = "scored";
    } else if (skill === "writing" || skill === "speaking") {
      test.status![skill] = reviewUrl ? "pending" : "unavailable";
    }

    test.overall = calculateOverallBand(
      test.listening,
      test.reading,
      test.writing,
      test.speaking,
    );
    grouped.set(id, test);
  }

  const tests = Array.from(grouped.values());
  console.log(
    `${LOG_PREFIX} Scraped grouped history tests:`,
    tests.map((test) => ({
      testName: test.testName,
      listening: test.listening,
      reading: test.reading,
      writing: test.writing,
      speaking: test.speaking,
      reviewUrls: test.reviewUrls,
      status: test.status,
    })),
  );
  return tests;
}

function getSkill(fullTestName: string): ResultType | null {
  const match = fullTestName.match(SKILL_PATTERN);
  if (!match) return null;
  return match[1].toLowerCase() as ResultType;
}

function normalizeTestName(fullTestName: string): string {
  return fullTestName.replace(SKILL_PATTERN, "").trim();
}

function parseScore(skill: ResultType, scoreText: string): number | undefined {
  if (skill === "reading" || skill === "listening") {
    const score = Number.parseFloat(scoreText);
    return isValidBand(score) ? score : undefined;
  }

  const match =
    scoreText.match(/By AI:\s*(\d+(?:\.\d+)?)/i) ||
    scoreText.match(/By Examiner:\s*(\d+(?:\.\d+)?)/i);
  if (!match) return undefined;
  const score = Number.parseFloat(match[1]);
  return isValidBand(score) ? score : undefined;
}

function isValidBand(score: number): boolean {
  return !Number.isNaN(score) && score >= 0 && score <= 9;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
