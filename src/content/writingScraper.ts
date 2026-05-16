// Writing result scraper for IELTS Online Tests
import { WritingResult } from "../shared/types";

const LOG_PREFIX = "[IELTSPlugin]";

/**
 * Check if current page is a writing result page
 */
export function isWritingResultPage(): boolean {
  const url = window.location.href;
  const isWritingPage = url.includes("/wot/result/");
  console.log(
    `${LOG_PREFIX} isWritingResultPage: ${isWritingPage}, URL: ${url}`,
  );
  return isWritingPage;
}

/**
 * Extract writing result data from the current page
 */
export function scrapeWritingResult(): WritingResult | null {
  console.log(`${LOG_PREFIX} Starting writing result scrape`);

  try {
    const url = window.location.href;
    const title = document.title || "Writing Test Result";

    // Extract Task 1 question and answer
    const task1Question = extractTask1Question();
    const task1Answer = extractTask1Answer();

    // Extract Task 2 question and answer
    const task2Question = extractTask2Question();
    const task2Answer = extractTask2Answer();

    if (!task1Question || !task1Answer || !task2Question || !task2Answer) {
      console.warn(`${LOG_PREFIX} Missing writing data:`, {
        task1Question: task1Question?.length,
        task1Answer: task1Answer?.length,
        task2Question: task2Question?.length,
        task2Answer: task2Answer?.length,
      });
      return null;
    }

    const result: WritingResult = {
      url,
      title,
      task1Question,
      task1Answer,
      task2Question,
      task2Answer,
    };

    console.log(`${LOG_PREFIX} Writing result scraped:`, {
      url,
      title,
      task1QuestionLength: task1Question.length,
      task1AnswerLength: task1Answer.length,
      task2QuestionLength: task2Question.length,
      task2AnswerLength: task2Answer.length,
    });

    return result;
  } catch (error) {
    console.error(`${LOG_PREFIX} Error scraping writing result:`, error);
    return null;
  }
}

function extractTask1Question(): string | null {
  const accordionText = extractTaskSectionText(1, "question");
  if (accordionText) return accordionText;

  // Try multiple selectors for Task 1 question
  const selectors = [
    ".task-1-question",
    '[data-task="1"] .question',
    ".writing-task-1 .question-text",
    ".task1 .question",
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element?.textContent?.trim()) {
      return element.textContent.trim();
    }
  }

  // Fallback: look for headings containing "Task 1" followed by content
  const headings = Array.from(document.querySelectorAll("h2, h3, h4"));
  const task1Heading = headings.find((h) =>
    h.textContent?.toLowerCase().includes("task 1"),
  );

  if (task1Heading) {
    let nextElement = task1Heading.nextElementSibling;
    while (nextElement) {
      const text = nextElement.textContent?.trim();
      if (text && text.length > 20) {
        return text;
      }
      nextElement = nextElement.nextElementSibling;
    }
  }

  console.warn(`${LOG_PREFIX} Could not extract Task 1 question`);
  return null;
}

function extractTask1Answer(): string | null {
  const accordionText = extractTaskSectionText(1, "answer");
  if (accordionText) return accordionText;

  // Try multiple selectors for Task 1 answer
  const selectors = [
    ".task-1-answer",
    '[data-task="1"] .answer',
    ".writing-task-1 .user-answer",
    ".task1 .answer",
    'textarea[name="task1"]',
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      const text =
        (element as HTMLTextAreaElement).value || element.textContent?.trim();
      if (text && text.length > 20) {
        return text;
      }
    }
  }

  console.warn(`${LOG_PREFIX} Could not extract Task 1 answer`);
  return null;
}

function extractTask2Question(): string | null {
  const accordionText = extractTaskSectionText(2, "question");
  if (accordionText) return accordionText;

  // Try multiple selectors for Task 2 question
  const selectors = [
    ".task-2-question",
    '[data-task="2"] .question',
    ".writing-task-2 .question-text",
    ".task2 .question",
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element?.textContent?.trim()) {
      return element.textContent.trim();
    }
  }

  // Fallback: look for headings containing "Task 2" followed by content
  const headings = Array.from(document.querySelectorAll("h2, h3, h4"));
  const task2Heading = headings.find((h) =>
    h.textContent?.toLowerCase().includes("task 2"),
  );

  if (task2Heading) {
    let nextElement = task2Heading.nextElementSibling;
    while (nextElement) {
      const text = nextElement.textContent?.trim();
      if (text && text.length > 20) {
        return text;
      }
      nextElement = nextElement.nextElementSibling;
    }
  }

  console.warn(`${LOG_PREFIX} Could not extract Task 2 question`);
  return null;
}

function extractTaskSectionText(
  taskNumber: 1 | 2,
  sectionLabel: "question" | "answer",
): string | null {
  const taskContainer =
    document.querySelector(`.question-part.-part-${taskNumber}`) ||
    Array.from(document.querySelectorAll(".question-part")).find((part) =>
      normalizeText(part.querySelector("h2")?.textContent).includes(
        `task ${taskNumber}`,
      ),
    );
  if (!taskContainer) return null;

  const panelSelector =
    sectionLabel === "question" ? ".panel.test-question" : ".panel.answer";
  const panel =
    taskContainer.querySelector(panelSelector) ||
    Array.from(taskContainer.querySelectorAll(".panel")).find((candidate) =>
      normalizeText(candidate.querySelector("h4")?.textContent).includes(
        sectionLabel,
      ),
    );
  if (!panel) return null;

  const content =
    panel.querySelector(".panel-body") ||
    panel.querySelector(".panel-collapse");
  const text = cleanText(content?.textContent || "");
  if (text.length > 20) {
    console.log(
      `${LOG_PREFIX} Extracted Task ${taskNumber} ${sectionLabel} from accordion: ${text.length} chars`,
    );
    return text;
  }

  return null;
}

function normalizeText(value?: string | null): string {
  return (value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function extractTask2Answer(): string | null {
  const accordionText = extractTaskSectionText(2, "answer");
  if (accordionText) return accordionText;

  // Try multiple selectors for Task 2 answer
  const selectors = [
    ".task-2-answer",
    '[data-task="2"] .answer',
    ".writing-task-2 .user-answer",
    ".task2 .answer",
    'textarea[name="task2"]',
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      const text =
        (element as HTMLTextAreaElement).value || element.textContent?.trim();
      if (text && text.length > 20) {
        return text;
      }
    }
  }

  console.warn(`${LOG_PREFIX} Could not extract Task 2 answer`);
  return null;
}
