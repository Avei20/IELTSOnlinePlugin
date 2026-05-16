// Background service worker for IELTS Plugin
import {
  Message,
  WritingResult,
  SpeakingResult,
  ObjectiveResult,
  IeltsTestScoreRow,
} from "../shared/types";
import { scoreWriting, scoreSpeaking } from "./geminiScorer";
import {
  storeObjectiveResult,
  storeWritingScore,
  storeSpeakingScore,
  storeHistoricalScores,
  storeHistoryTests,
  updateTestSkillScore,
  updateTestSkillStatus,
  getCombinedScore,
} from "./scoreCombiner";

const LOG_PREFIX = "[IELTSPlugin]";

/**
 * Listen for messages from content scripts
 */
chrome.runtime.onMessage.addListener(
  (message: Message, sender, sendResponse) => {
    console.log(`${LOG_PREFIX} Received message:`, message.type);

    // Handle message asynchronously
    handleMessage(message, sender).then(sendResponse);

    // Return true to indicate we will send a response asynchronously
    return true;
  },
);

/**
 * Handle incoming messages
 */
async function handleMessage(
  message: Message,
  sender?: chrome.runtime.MessageSender,
): Promise<any> {
  try {
    switch (message.type) {
      case "WRITING_RESULT_SCRAPED":
        return await handleWritingResult(
          message.payload as WritingResult,
          sender,
        );

      case "SPEAKING_RESULT_SCRAPED":
        return await handleSpeakingResult(
          message.payload as SpeakingResult,
          sender,
        );

      case "OBJECTIVE_RESULT_SCRAPED":
        return await handleObjectiveResult(message.payload as ObjectiveResult);

      case "HISTORY_SCORES_SCRAPED":
        return await handleHistoricalScores(message.payload);

      case "HISTORY_TESTS_SCRAPED":
        return await handleHistoryTests(message.payload as IeltsTestScoreRow[]);

      case "GET_COMBINED_SCORE":
        return await getCombinedScore();

      default:
        console.warn(`${LOG_PREFIX} Unknown message type:`, message.type);
        return { success: false, error: "Unknown message type" };
    }
  } catch (error) {
    console.error(`${LOG_PREFIX} Error handling message:`, error);
    return { success: false, error: String(error) };
  }
}

/**
 * Handle writing result - score with Gemini and store
 */
async function handleWritingResult(
  result: WritingResult,
  sender?: chrome.runtime.MessageSender,
): Promise<any> {
  console.log(`${LOG_PREFIX} Processing writing result from ${result.url}`);

  try {
    // Score with Gemini
    const score = await scoreWriting(result);

    const test = await findTestByReviewUrl(result.url, "writing");
    if (!score) {
      if (test) await updateTestSkillStatus(test.id, "writing", "error");
      closeBatchTab(sender);
      return { success: false, error: "Failed to score writing" };
    }
    if (test) {
      await updateTestSkillScore(test.id, "writing", score);
    } else {
      await storeWritingScore(score);
    }
    closeBatchTab(sender);

    return { success: true, score };
  } catch (error) {
    console.error(`${LOG_PREFIX} Error processing writing result:`, error);
    return { success: false, error: String(error) };
  }
}

/**
 * Handle speaking result - score with Gemini and store
 */
async function handleSpeakingResult(
  result: SpeakingResult,
  sender?: chrome.runtime.MessageSender,
): Promise<any> {
  console.log(`${LOG_PREFIX} Processing speaking result from ${result.url}`);

  try {
    // Score with Gemini
    const score = await scoreSpeaking(result);

    const test = await findTestByReviewUrl(result.url, "speaking");
    if (!score) {
      if (test) await updateTestSkillStatus(test.id, "speaking", "error");
      closeBatchTab(sender);
      return { success: false, error: "Failed to score speaking" };
    }
    if (test) {
      await updateTestSkillScore(test.id, "speaking", score);
    } else {
      await storeSpeakingScore(score);
    }
    closeBatchTab(sender);

    return { success: true, score };
  } catch (error) {
    console.error(`${LOG_PREFIX} Error processing speaking result:`, error);
    return { success: false, error: String(error) };
  }
}

/**
 * Handle objective result - store platform score
 */
async function handleObjectiveResult(result: ObjectiveResult): Promise<any> {
  console.log(
    `${LOG_PREFIX} Processing ${result.resultType} result from ${result.url}`,
  );

  try {
    // Store the platform score
    await storeObjectiveResult(result);

    return { success: true, band: result.platformBand };
  } catch (error) {
    console.error(`${LOG_PREFIX} Error processing objective result:`, error);
    return { success: false, error: String(error) };
  }
}

/**
 * Handle historical scores - store them
 */
async function handleHistoricalScores(scores: any): Promise<any> {
  console.log(`${LOG_PREFIX} Processing historical scores`);

  try {
    await storeHistoricalScores(scores);
    return { success: true };
  } catch (error) {
    console.error(`${LOG_PREFIX} Error processing historical scores:`, error);
    return { success: false, error: String(error) };
  }
}

async function handleHistoryTests(tests: IeltsTestScoreRow[]): Promise<any> {
  console.log(`${LOG_PREFIX} Processing grouped history tests`, tests.length);
  await storeHistoryTests(tests);
  await startBatchScoring(tests);
  return { success: true, tests: tests.length };
}

async function startBatchScoring(tests: IeltsTestScoreRow[]): Promise<void> {
  for (const test of tests) {
    for (const skill of ["writing", "speaking"] as const) {
      if (test[skill] !== undefined || !test.reviewUrls[skill]) continue;
      await updateTestSkillStatus(test.id, skill, "scoring");
      console.log(
        `${LOG_PREFIX} Opening ${skill} review for scoring`,
        test.reviewUrls[skill],
      );
      chrome.tabs.create({ url: test.reviewUrls[skill], active: false });
    }
  }
}

async function findTestByReviewUrl(
  url: string,
  skill: "writing" | "speaking",
): Promise<IeltsTestScoreRow | undefined> {
  const scores = await getCombinedScore();
  const normalizedUrl = normalizeUrl(url);
  return scores.tests?.find(
    (test) => normalizeUrl(test.reviewUrls[skill]) === normalizedUrl,
  );
}

function normalizeUrl(url?: string): string {
  if (!url) return "";
  try {
    return new URL(url).href.replace(/\/$/, "");
  } catch {
    return url.replace(/\/$/, "");
  }
}

function closeBatchTab(sender?: chrome.runtime.MessageSender): void {
  if (sender?.tab?.id !== undefined && sender.tab.active === false) {
    chrome.tabs.remove(sender.tab.id);
  }
}

/**
 * Log when extension is installed or updated
 */
chrome.runtime.onInstalled.addListener((details) => {
  console.log(`${LOG_PREFIX} Extension installed/updated:`, details.reason);

  if (details.reason === "install") {
    // Open options page on first install
    chrome.runtime.openOptionsPage();
  }
});

console.log(`${LOG_PREFIX} Background service worker initialized`);
