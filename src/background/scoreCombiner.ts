// Score combiner - combines platform scores with AI scores
import {
  CombinedIeltsScore,
  ObjectiveResult,
  AiIeltsScore,
  IeltsTestScoreRow,
  ResultType,
} from "../shared/types";
import { calculateOverallBand } from "../shared/ieltsMath";

const LOG_PREFIX = "[IELTSPlugin]";
const STORAGE_KEY = "ieltsScores";

/**
 * Store objective (reading/listening) result
 */
export async function storeObjectiveResult(
  result: ObjectiveResult,
): Promise<void> {
  console.log(`${LOG_PREFIX} Storing ${result.resultType} result`);

  const scores = await getStoredScores();

  // Update the appropriate skill
  if (result.resultType === "reading") {
    scores.reading = result.platformBand;
    scores.sources.reading = "platform";
    scores.details = scores.details || {};
    scores.details.reading = result;
  } else if (result.resultType === "listening") {
    scores.listening = result.platformBand;
    scores.sources.listening = "platform";
    scores.details = scores.details || {};
    scores.details.listening = result;
  }

  updateTestObjectiveResultByUrl(scores, result);

  // Recalculate overall band
  scores.overall = calculateOverallBand(
    scores.listening,
    scores.reading,
    scores.writing,
    scores.speaking,
  );

  await saveScores(scores);
  console.log(
    `${LOG_PREFIX} ${result.resultType} score stored:`,
    result.platformBand,
  );
}

/**
 * Store AI writing score
 */
export async function storeWritingScore(
  score: AiIeltsScore,
  url?: string,
): Promise<void> {
  console.log(`${LOG_PREFIX} Storing writing score`);

  const scores = await getStoredScores();

  scores.writing = score.overallBand;
  scores.sources.writing = "ai";
  scores.details = scores.details || {};
  scores.details.writing = score;
  if (url) cacheAiScore(scores, "writing", url, score);

  // Recalculate overall band
  scores.overall = calculateOverallBand(
    scores.listening,
    scores.reading,
    scores.writing,
    scores.speaking,
  );

  await saveScores(scores);
  console.log(`${LOG_PREFIX} Writing score stored:`, score.overallBand);
}

/**
 * Store AI speaking score
 */
export async function storeSpeakingScore(
  score: AiIeltsScore,
  url?: string,
): Promise<void> {
  console.log(`${LOG_PREFIX} Storing speaking score`);

  const scores = await getStoredScores();

  scores.speaking = score.overallBand;
  scores.sources.speaking = "ai";
  scores.details = scores.details || {};
  scores.details.speaking = score;
  if (url) cacheAiScore(scores, "speaking", url, score);

  // Recalculate overall band
  scores.overall = calculateOverallBand(
    scores.listening,
    scores.reading,
    scores.writing,
    scores.speaking,
  );

  await saveScores(scores);
  console.log(`${LOG_PREFIX} Speaking score stored:`, score.overallBand);
}

/**
 * Store historical scores scraped from the history page
 */
export async function storeHistoricalScores(
  historyScores: Partial<CombinedIeltsScore>,
): Promise<void> {
  console.log(`${LOG_PREFIX} Storing historical scores`);

  const scores = await getStoredScores();

  // Only update if we don't already have a score or if the history score is newer/better
  // For simplicity, we'll overwrite if the history score exists

  if (historyScores.reading !== undefined) {
    scores.reading = historyScores.reading;
    scores.sources.reading = "platform";
    if (historyScores.details?.reading) {
      scores.details = scores.details || {};
      scores.details.reading = historyScores.details.reading;
    }
  }

  if (historyScores.listening !== undefined) {
    scores.listening = historyScores.listening;
    scores.sources.listening = "platform";
    if (historyScores.details?.listening) {
      scores.details = scores.details || {};
      scores.details.listening = historyScores.details.listening;
    }
  }

  if (historyScores.writing !== undefined) {
    scores.writing = historyScores.writing;
    scores.sources.writing = "platform";
  }

  if (historyScores.speaking !== undefined) {
    scores.speaking = historyScores.speaking;
    scores.sources.speaking = "platform";
  }

  // Recalculate overall band
  scores.overall = calculateOverallBand(
    scores.listening,
    scores.reading,
    scores.writing,
    scores.speaking,
  );

  await saveScores(scores);
  console.log(`${LOG_PREFIX} Historical scores stored:`, scores);
}

export async function storeHistoryTests(
  tests: IeltsTestScoreRow[],
): Promise<void> {
  console.log(`${LOG_PREFIX} Storing grouped history tests`, tests.length);
  const scores = await getStoredScores();
  const existing = new Map((scores.tests || []).map((test) => [test.id, test]));

  for (const test of tests) {
    const previous = existing.get(test.id);
    const merged: IeltsTestScoreRow = {
      ...test,
      ...previous,
      listening: test.listening ?? previous?.listening,
      reading: test.reading ?? previous?.reading,
      writing: previous?.writing ?? test.writing,
      speaking: previous?.speaking ?? test.speaking,
      reviewUrls: { ...test.reviewUrls, ...previous?.reviewUrls },
      sources: { ...test.sources, ...previous?.sources },
      status: { ...test.status, ...previous?.status },
      aiDetails: previous?.aiDetails,
      objectiveDetails: previous?.objectiveDetails,
    };
    merged.overall = calculateOverallBand(
      merged.listening,
      merged.reading,
      merged.writing,
      merged.speaking,
    );
    existing.set(test.id, merged);
  }

  scores.tests = Array.from(existing.values());
  const latest = scores.tests[0];
  if (latest) {
    scores.listening = latest.listening;
    scores.reading = latest.reading;
    scores.writing = latest.writing;
    scores.speaking = latest.speaking;
    scores.overall = latest.overall;
  }
  await saveScores(scores);
}

export async function updateTestSkillScore(
  testId: string,
  skill: Extract<ResultType, "writing" | "speaking">,
  score: AiIeltsScore,
): Promise<void> {
  const scores = await getStoredScores();
  const tests = scores.tests || [];
  const test = tests.find((item) => item.id === testId);
  if (!test) return;

  test[skill] = score.overallBand;
  test.sources[skill] = "ai";
  test.status = test.status || {};
  test.status[skill] = "scored";
  test.aiDetails = test.aiDetails || {};
  test.aiDetails[skill] = score;
  if (test.reviewUrls[skill])
    cacheAiScore(scores, skill, test.reviewUrls[skill], score);
  test.overall = calculateOverallBand(
    test.listening,
    test.reading,
    test.writing,
    test.speaking,
  );

  await saveScores({ ...scores, tests });
}

export async function clearTestAiSkillScore(
  testId: string,
  skill: Extract<ResultType, "writing" | "speaking">,
): Promise<IeltsTestScoreRow | undefined> {
  const scores = await getStoredScores();
  const tests = scores.tests || [];
  const test = tests.find((item) => item.id === testId);
  if (!test) return undefined;

  delete test[skill];
  delete test.aiDetails?.[skill];
  if (test.reviewUrls[skill]) {
    delete scores.aiScoreCache?.[skill]?.[normalizeUrl(test.reviewUrls[skill])];
  }
  test.status = test.status || {};
  test.status[skill] = "pending";
  test.overall = calculateOverallBand(
    test.listening,
    test.reading,
    test.writing,
    test.speaking,
  );
  await saveScores({ ...scores, tests });
  return test;
}

export async function updateTestSkillStatus(
  testId: string,
  skill: Extract<ResultType, "writing" | "speaking">,
  status: "scoring" | "error",
): Promise<void> {
  const scores = await getStoredScores();
  const tests = scores.tests || [];
  const test = tests.find((item) => item.id === testId);
  if (!test) return;
  test.status = test.status || {};
  test.status[skill] = status;
  await saveScores({ ...scores, tests });
}

/**
 * Get combined IELTS score
 */
export async function getCombinedScore(): Promise<CombinedIeltsScore> {
  return await getStoredScores();
}

export async function getCachedScoreByUrl(
  skill: Extract<ResultType, "writing" | "speaking">,
  url: string,
): Promise<AiIeltsScore | undefined> {
  const scores = await getStoredScores();
  return scores.aiScoreCache?.[skill]?.[normalizeUrl(url)];
}

export async function getCachedObjectiveResultByUrl(
  skill: Extract<ResultType, "reading" | "listening">,
  url: string,
): Promise<ObjectiveResult | undefined> {
  const scores = await getStoredScores();
  const normalizedUrl = normalizeUrl(url);
  return scores.tests?.find(
    (test) => normalizeUrl(test.reviewUrls[skill] || "") === normalizedUrl,
  )?.objectiveDetails?.[skill];
}

/**
 * Get stored scores from chrome.storage.local
 */
async function getStoredScores(): Promise<CombinedIeltsScore> {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      const defaultScores: CombinedIeltsScore = {
        sources: {},
      };

      resolve(result[STORAGE_KEY] || defaultScores);
    });
  });
}

function updateTestObjectiveResultByUrl(
  scores: CombinedIeltsScore,
  result: ObjectiveResult,
): void {
  const tests = scores.tests || [];
  const normalizedUrl = normalizeUrl(result.url);
  const test = tests.find(
    (item) =>
      normalizeUrl(item.reviewUrls[result.resultType] || "") === normalizedUrl,
  );
  if (!test) return;

  test[result.resultType] = result.platformBand;
  test.sources[result.resultType] = "platform";
  test.status = test.status || {};
  test.status[result.resultType] = "scored";
  test.objectiveDetails = test.objectiveDetails || {};
  test.objectiveDetails[result.resultType] = result;
  test.overall = calculateOverallBand(
    test.listening,
    test.reading,
    test.writing,
    test.speaking,
  );
}

function cacheAiScore(
  scores: CombinedIeltsScore,
  skill: Extract<ResultType, "writing" | "speaking">,
  url: string,
  score: AiIeltsScore,
): void {
  scores.aiScoreCache = scores.aiScoreCache || {};
  scores.aiScoreCache[skill] = scores.aiScoreCache[skill] || {};
  scores.aiScoreCache[skill][normalizeUrl(url)] = score;
}

function normalizeUrl(url: string): string {
  try {
    return new URL(url).href.replace(/\/$/, "");
  } catch {
    return url.replace(/\/$/, "");
  }
}

/**
 * Save scores to chrome.storage.local
 */
async function saveScores(scores: CombinedIeltsScore): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: scores }, () => {
      console.log(`${LOG_PREFIX} Scores saved to storage`);
      resolve();
    });
  });
}

/**
 * Clear all stored scores
 */
export async function clearScores(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.remove([STORAGE_KEY], () => {
      console.log(`${LOG_PREFIX} Scores cleared from storage`);
      resolve();
    });
  });
}
