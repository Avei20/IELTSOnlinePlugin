// Main content script for IELTS Plugin
import { isWritingResultPage, scrapeWritingResult } from "./writingScraper";
import { isSpeakingResultPage, scrapeSpeakingResult } from "./speakingScraper";
import {
  isObjectiveResultPage,
  scrapeObjectiveResult,
} from "./objectiveScraper";
import { isHistoryPage, scrapeHistoryTests } from "./historyScraper";
import {
  WritingResultMessage,
  SpeakingResultMessage,
  ObjectiveResultMessage,
} from "../shared/types";

const LOG_PREFIX = "[IELTSPlugin]";

/**
 * Initialize content script
 */
function init() {
  console.log(
    `${LOG_PREFIX} Content script initialized on ${window.location.href}`,
  );

  // Check page type and scrape if it's a result page
  checkAndScrape();

  // Listen for URL changes (for single-page apps)
  let lastUrl = window.location.href;
  const observer = new MutationObserver(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      console.log(`${LOG_PREFIX} URL changed to ${currentUrl}`);
      checkAndScrape();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

/**
 * Check page type and scrape data if applicable
 */
function checkAndScrape() {
  // Wait for page to load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", checkAndScrape);
    return;
  }

  // Check if it's a writing result page
  if (isWritingResultPage()) {
    setTimeout(() => {
      const result = scrapeWritingResult();
      if (result) {
        sendToBackground({
          type: "WRITING_RESULT_SCRAPED",
          payload: result,
        });
      }
    }, 1000); // Wait for dynamic content to load
    return;
  }

  // Check if it's a speaking result page
  if (isSpeakingResultPage()) {
    setTimeout(() => {
      const result = scrapeSpeakingResult();
      if (result) {
        sendToBackground({
          type: "SPEAKING_RESULT_SCRAPED",
          payload: result,
        });
      }
    }, 1000);
    return;
  }

  // Check if it's a reading or listening result page
  const objectiveCheck = isObjectiveResultPage();
  if (objectiveCheck.isResult && objectiveCheck.type) {
    setTimeout(() => {
      const result = scrapeObjectiveResult(objectiveCheck.type!);
      if (result) {
        sendToBackground({
          type: "OBJECTIVE_RESULT_SCRAPED",
          payload: result,
        });
      }
    }, 1000);
    return;
  }

  // Check if it's the practice test history page
  if (isHistoryPage()) {
    setTimeout(() => {
      const tests = scrapeHistoryTests();
      if (tests.length > 0) {
        chrome.runtime.sendMessage({
          type: "HISTORY_TESTS_SCRAPED",
          payload: tests,
        });
      }
    }, 1000);
    return;
  }

  console.log(`${LOG_PREFIX} Not a result page`);
}

/**
 * Send message to background service worker
 */
function sendToBackground(
  message:
    | WritingResultMessage
    | SpeakingResultMessage
    | ObjectiveResultMessage,
) {
  console.log(`${LOG_PREFIX} Sending message to background:`, message.type);

  chrome.runtime.sendMessage(message, (response) => {
    if (chrome.runtime.lastError) {
      console.error(
        `${LOG_PREFIX} Error sending message:`,
        chrome.runtime.lastError,
      );
    } else {
      console.log(`${LOG_PREFIX} Background response:`, response);
    }
  });
}

// Initialize when script loads
init();
