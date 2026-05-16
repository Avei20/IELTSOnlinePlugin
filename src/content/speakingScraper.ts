// Speaking result scraper for IELTS Online Tests
import { SpeakingResult, SpeakingPart } from "../shared/types";

const LOG_PREFIX = "[IELTSPlugin]";

/**
 * Check if current page is a speaking result page
 */
export function isSpeakingResultPage(): boolean {
  const url = window.location.href;
  const isSpeakingPage =
    url.includes("/sot/result/") ||
    (url.includes("/speaking") && url.includes("/result"));
  console.log(
    `${LOG_PREFIX} isSpeakingResultPage: ${isSpeakingPage}, URL: ${url}`,
  );
  return isSpeakingPage;
}

/**
 * Extract speaking result data from the current page
 */
export function scrapeSpeakingResult(): SpeakingResult | null {
  console.log(`${LOG_PREFIX} Starting speaking result scrape`);

  try {
    const url = window.location.href;
    const title = document.title || "Speaking Test Result";

    // Extract speaking parts (Part 1, Part 2, Part 3)
    const parts = extractSpeakingParts();

    if (parts.length === 0) {
      console.warn(`${LOG_PREFIX} No speaking parts found`);
      return null;
    }

    const result: SpeakingResult = {
      url,
      title,
      parts,
    };

    console.log(`${LOG_PREFIX} Speaking result scraped:`, {
      url,
      title,
      partsCount: parts.length,
    });

    return result;
  } catch (error) {
    console.error(`${LOG_PREFIX} Error scraping speaking result:`, error);
    return null;
  }
}

function extractSpeakingParts(): SpeakingPart[] {
  const recordingPanels = Array.from(
    document.querySelectorAll(".recordings-panel .recording"),
  );
  if (recordingPanels.length > 0) {
    const parts = recordingPanels
      .map((panel, index) => extractRecordingPanel(panel, index + 1))
      .filter((part): part is SpeakingPart => Boolean(part));
    console.log(
      `${LOG_PREFIX} Extracted speaking recording panels:`,
      parts.map((part) => ({
        partNumber: part.partNumber,
        questions: part.questions.length,
        audioUrl: part.audioUrl,
      })),
    );
    return parts;
  }

  const parts: SpeakingPart[] = [];

  // Try to find parts 1, 2, and 3
  for (let partNum = 1; partNum <= 3; partNum++) {
    const part = extractSpeakingPart(partNum);
    if (part) {
      parts.push(part);
    }
  }

  return parts;
}

function extractRecordingPanel(
  panel: Element,
  fallbackPartNumber: number,
): SpeakingPart | null {
  const title =
    panel
      .querySelector(".recording__collapse")
      ?.textContent?.replace(/\s+/g, " ")
      .trim() || "";
  const partMatch = title.match(/PART\s+(\d+)/i);
  const partNumber = partMatch ? Number(partMatch[1]) : fallbackPartNumber;
  const audioUrl = extractAudioUrl(panel);
  const questions = Array.from(
    panel.querySelectorAll(".recording__question-title"),
  )
    .map(extractQuestionTitleText)
    .filter((question) => question.length > 0);

  if (questions.length === 0 && !audioUrl) {
    console.warn(`${LOG_PREFIX} No speaking data found in recording panel`, {
      title,
    });
    return null;
  }

  return {
    partNumber,
    questions,
    audioUrl,
  };
}

function extractQuestionTitleText(element: Element): string {
  const cloned = element.cloneNode(true) as HTMLElement;
  cloned
    .querySelectorAll(".sound-bars, .recording__question-time")
    .forEach((node) => node.remove());
  return cloned.textContent?.replace(/\s+/g, " ").trim() || "";
}

function extractSpeakingPart(partNumber: number): SpeakingPart | null {
  // Try multiple selectors for speaking part
  const selectors = [
    `.speaking-part-${partNumber}`,
    `[data-part="${partNumber}"]`,
    `.part-${partNumber}`,
    `.part${partNumber}`,
  ];

  let partContainer: Element | null = null;

  for (const selector of selectors) {
    partContainer = document.querySelector(selector);
    if (partContainer) break;
  }

  // Fallback: look for headings containing "Part X"
  if (!partContainer) {
    const headings = Array.from(document.querySelectorAll("h2, h3, h4"));
    const partHeading = headings.find((h) => {
      const text = h.textContent?.toLowerCase() || "";
      return (
        text.includes(`part ${partNumber}`) ||
        text.includes(`part${partNumber}`)
      );
    });

    if (partHeading) {
      partContainer = partHeading.parentElement || partHeading;
    }
  }

  if (!partContainer) {
    console.warn(
      `${LOG_PREFIX} Could not find container for Part ${partNumber}`,
    );
    return null;
  }

  // Extract questions
  const questions = extractQuestions(partContainer);

  // Extract transcript if available
  const transcript = extractTranscript(partContainer);

  // Extract audio URL if available
  const audioUrl = extractAudioUrl(partContainer);

  if (questions.length === 0 && !transcript && !audioUrl) {
    console.warn(`${LOG_PREFIX} No data found for Part ${partNumber}`);
    return null;
  }

  return {
    partNumber,
    questions,
    transcript,
    audioUrl,
  };
}

function extractQuestions(container: Element): string[] {
  const questions: string[] = [];

  // Try multiple selectors for questions
  const questionSelectors = [
    ".question",
    ".speaking-question",
    "[data-question]",
    "li",
    "p",
  ];

  for (const selector of questionSelectors) {
    const elements = Array.from(container.querySelectorAll(selector));
    for (const element of elements) {
      const text = element.textContent?.trim();
      if (text && text.length > 10 && text.includes("?")) {
        questions.push(text);
      }
    }

    if (questions.length > 0) break;
  }

  return questions;
}

function extractTranscript(container: Element): string | undefined {
  // Try multiple selectors for transcript
  const selectors = [
    ".transcript",
    ".speaking-transcript",
    ".user-response",
    "[data-transcript]",
    "textarea",
  ];

  for (const selector of selectors) {
    const element = container.querySelector(selector);
    if (element) {
      const text =
        (element as HTMLTextAreaElement).value || element.textContent?.trim();
      if (text && text.length > 20) {
        return text;
      }
    }
  }

  return undefined;
}

function extractAudioUrl(container: Element): string | undefined {
  // Try to find audio elements
  const audioElement = container.querySelector("audio");
  if (audioElement?.src) {
    return audioElement.src;
  }

  // Try to find audio source elements
  const sourceElement = container.querySelector("audio source");
  if (sourceElement?.getAttribute("src")) {
    return sourceElement.getAttribute("src") || undefined;
  }

  // Try to find links to audio files
  const audioLink = container.querySelector(
    'a[href*=".mp3"], a[href*=".wav"], a[href*=".m4a"]',
  );
  if (audioLink?.getAttribute("href")) {
    return audioLink.getAttribute("href") || undefined;
  }

  return undefined;
}
