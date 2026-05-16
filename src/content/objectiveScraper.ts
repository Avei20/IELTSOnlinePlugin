// Reading and Listening result scraper for IELTS Online Tests
import { ObjectiveResult } from '../shared/types';

const LOG_PREFIX = '[IELTSPlugin]';

/**
 * Check if current page is a reading or listening result page
 */
export function isObjectiveResultPage(): { isResult: boolean; type: 'reading' | 'listening' | null } {
  const url = window.location.href;

  // Check for reading result
  if (url.includes('/reading') && url.includes('/result')) {
    console.log(`${LOG_PREFIX} Detected reading result page: ${url}`);
    return { isResult: true, type: 'reading' };
  }

  // Check for listening result
  if (url.includes('/listening') && url.includes('/result')) {
    console.log(`${LOG_PREFIX} Detected listening result page: ${url}`);
    return { isResult: true, type: 'listening' };
  }

  return { isResult: false, type: null };
}

/**
 * Extract objective (reading/listening) result data from the current page
 */
export function scrapeObjectiveResult(type: 'reading' | 'listening'): ObjectiveResult | null {
  console.log(`${LOG_PREFIX} Starting ${type} result scrape`);

  try {
    const url = window.location.href;
    const title = document.title || `${type.charAt(0).toUpperCase() + type.slice(1)} Test Result`;

    // Extract platform band score
    const platformBand = extractPlatformBand();

    if (platformBand === null) {
      console.warn(`${LOG_PREFIX} Could not extract platform band for ${type}`);
      return null;
    }

    // Extract raw score if available
    const rawScore = extractRawScore();

    const result: ObjectiveResult = {
      url,
      title,
      resultType: type,
      platformBand,
      rawScore
    };

    console.log(`${LOG_PREFIX} ${type} result scraped:`, {
      url,
      title,
      platformBand,
      rawScore
    });

    return result;
  } catch (error) {
    console.error(`${LOG_PREFIX} Error scraping ${type} result:`, error);
    return null;
  }
}

function extractPlatformBand(): number | null {
  // Try multiple selectors for band score
  const selectors = [
    '.band-score',
    '.ielts-band',
    '.score-band',
    '[data-band]',
    '.result-band',
    '.overall-band'
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      // Try data attribute first
      const dataBand = element.getAttribute('data-band');
      if (dataBand) {
        const band = parseFloat(dataBand);
        if (!isNaN(band) && band >= 0 && band <= 9) {
          return band;
        }
      }

      // Try text content
      const text = element.textContent?.trim();
      if (text) {
        const match = text.match(/(\d+(?:\.\d+)?)/);
        if (match) {
          const band = parseFloat(match[1]);
          if (!isNaN(band) && band >= 0 && band <= 9) {
            return band;
          }
        }
      }
    }
  }

  // Fallback: search for "Band" or "Score" text in the page
  const bodyText = document.body.textContent || '';
  const bandMatch = bodyText.match(/(?:Band|Score):\s*(\d+(?:\.\d+)?)/i);
  if (bandMatch) {
    const band = parseFloat(bandMatch[1]);
    if (!isNaN(band) && band >= 0 && band <= 9) {
      return band;
    }
  }

  console.warn(`${LOG_PREFIX} Could not extract platform band score`);
  return null;
}

function extractRawScore(): string | undefined {
  // Try multiple selectors for raw score (e.g., "35/40")
  const selectors = [
    '.raw-score',
    '.correct-answers',
    '.score-fraction',
    '[data-raw-score]'
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      const dataScore = element.getAttribute('data-raw-score');
      if (dataScore) {
        return dataScore;
      }

      const text = element.textContent?.trim();
      if (text) {
        const match = text.match(/(\d+\s*\/\s*\d+)/);
        if (match) {
          return match[1];
        }
      }
    }
  }

  // Fallback: search for fraction pattern in the page
  const bodyText = document.body.textContent || '';
  const scoreMatch = bodyText.match(/(\d+)\s*\/\s*(\d+)/);
  if (scoreMatch) {
    return `${scoreMatch[1]}/${scoreMatch[2]}`;
  }

  return undefined;
}
