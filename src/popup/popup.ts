// Popup script for IELTS Plugin
const LOG_PREFIX = "[IELTSPlugin]";

// DOM elements
const apiKeyInput = document.getElementById("apiKeyInput") as HTMLInputElement;
const saveApiKeyBtn = document.getElementById(
  "saveApiKeyBtn",
) as HTMLButtonElement;
const apiKeyStatus = document.getElementById("apiKeyStatus") as HTMLDivElement;
const scoresContainer = document.getElementById(
  "scoresContainer",
) as HTMLDivElement;
const feedbackSection = document.getElementById(
  "feedbackSection",
) as HTMLDivElement;
const refreshBtn = document.getElementById("refreshBtn") as HTMLButtonElement;
const clearBtn = document.getElementById("clearBtn") as HTMLButtonElement;

// Initialize popup
document.addEventListener("DOMContentLoaded", () => {
  loadApiKey();
  loadScores();

  // Event listeners
  saveApiKeyBtn.addEventListener("click", saveApiKey);
  refreshBtn.addEventListener("click", loadScores);
  clearBtn.addEventListener("click", clearAllScores);
});

/**
 * Load API key from storage
 */
async function loadApiKey() {
  chrome.storage.local.get(["geminiApiKey"], (result) => {
    if (result.geminiApiKey) {
      apiKeyInput.value = result.geminiApiKey;
      showStatus(apiKeyStatus, "API key loaded", "success");
    }
  });
}

/**
 * Save API key to storage
 */
async function saveApiKey() {
  const apiKey = apiKeyInput.value.trim();

  if (!apiKey) {
    showStatus(apiKeyStatus, "Please enter an API key", "error");
    return;
  }

  chrome.storage.local.set({ geminiApiKey: apiKey }, () => {
    showStatus(apiKeyStatus, "API key saved successfully", "success");
    console.log(`${LOG_PREFIX} API key saved`);
  });
}

/**
 * Load scores from background
 */
async function loadScores() {
  console.log(`${LOG_PREFIX} Loading scores`);

  chrome.runtime.sendMessage({ type: "GET_COMBINED_SCORE" }, (response) => {
    if (chrome.runtime.lastError) {
      console.error(
        `${LOG_PREFIX} Error loading scores:`,
        chrome.runtime.lastError,
      );
      scoresContainer.innerHTML =
        '<div class="no-data">Error loading scores</div>';
      return;
    }

    console.log(`${LOG_PREFIX} Scores loaded:`, response);
    displayScores(response);
  });
}

/**
 * Display scores in the UI
 */
function displayScores(scores: any) {
  if (Array.isArray(scores.tests) && scores.tests.length > 0) {
    displayScoreTable(scores.tests);
    displayFeedback(scores.details);
    return;
  }

  const hasScores =
    scores.listening || scores.reading || scores.writing || scores.speaking;

  if (!hasScores) {
    scoresContainer.innerHTML =
      '<div class="no-data">No scores available yet. Open Practice Test History to import your tests.</div>';
    feedbackSection.classList.add("hidden");
    return;
  }

  // Build scores grid
  let html = '<div class="scores-grid">';

  // Overall score (if available)
  if (scores.overall) {
    html += `
      <div class="score-card overall-score">
        <div class="score-label">Overall Band</div>
        <div class="score-value">${scores.overall.toFixed(1)}</div>
      </div>
    `;
  }

  // Listening
  if (scores.listening) {
    html += `
      <div class="score-card">
        <div class="score-label">Listening</div>
        <div class="score-value">${scores.listening.toFixed(1)}</div>
        <div class="score-source">${scores.sources.listening || "platform"}</div>
      </div>
    `;
  }

  // Reading
  if (scores.reading) {
    html += `
      <div class="score-card">
        <div class="score-label">Reading</div>
        <div class="score-value">${scores.reading.toFixed(1)}</div>
        <div class="score-source">${scores.sources.reading || "platform"}</div>
      </div>
    `;
  }

  // Writing
  if (scores.writing) {
    html += `
      <div class="score-card">
        <div class="score-label">Writing</div>
        <div class="score-value">${scores.writing.toFixed(1)}</div>
        <div class="score-source">${scores.sources.writing || "ai"}</div>
      </div>
    `;
  }

  // Speaking
  if (scores.speaking) {
    html += `
      <div class="score-card">
        <div class="score-label">Speaking</div>
        <div class="score-value">${scores.speaking.toFixed(1)}</div>
        <div class="score-source">${scores.sources.speaking || "ai"}</div>
      </div>
    `;
  }

  html += "</div>";
  scoresContainer.innerHTML = html;

  // Display feedback if available
  displayFeedback(scores.details);
}

function displayScoreTable(tests: any[]) {
  scoresContainer.innerHTML = `
    <table class="scores-table">
      <thead>
        <tr>
          <th>Test Name</th>
          <th>Listening</th>
          <th>Reading</th>
          <th>Writing</th>
          <th>Speaking</th>
          <th>IELTS Result</th>
        </tr>
      </thead>
      <tbody>
        ${tests.map(renderTestRow).join("")}
      </tbody>
    </table>
  `;
}

function renderTestRow(test: any): string {
  return `
    <tr>
      <td>${escapeHtml(test.testName)}<div class="muted">${escapeHtml(test.date || "")}</div></td>
      <td>${renderBand(test.listening, test.status?.listening)}</td>
      <td>${renderBand(test.reading, test.status?.reading)}</td>
      <td>${renderBand(test.writing, test.status?.writing)}</td>
      <td>${renderBand(test.speaking, test.status?.speaking)}</td>
      <td>${renderBand(test.overall)}</td>
    </tr>
  `;
}

function renderBand(value?: number, status?: string): string {
  if (typeof value === "number")
    return `<span class="band">${value.toFixed(1)}</span>`;
  if (status === "scoring") return '<span class="muted">Scoring…</span>';
  if (status === "pending") return '<span class="muted">Pending</span>';
  if (status === "error") return '<span class="muted">Error</span>';
  return '<span class="muted">-</span>';
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[char] || char,
  );
}

/**
 * Display feedback from AI scoring
 */
function displayFeedback(details: any) {
  if (!details) {
    feedbackSection.classList.add("hidden");
    return;
  }

  // Collect all feedback from writing and speaking
  const allStrengths: string[] = [];
  const allWeaknesses: string[] = [];
  const allCorrections: string[] = [];
  const allActionPlan: string[] = [];

  if (details.writing) {
    allStrengths.push(...(details.writing.strengths || []));
    allWeaknesses.push(...(details.writing.weaknesses || []));
    allCorrections.push(...(details.writing.corrections || []));
    allActionPlan.push(...(details.writing.actionPlan || []));
  }

  if (details.speaking) {
    allStrengths.push(...(details.speaking.strengths || []));
    allWeaknesses.push(...(details.speaking.weaknesses || []));
    allCorrections.push(...(details.speaking.corrections || []));
    allActionPlan.push(...(details.speaking.actionPlan || []));
  }

  // Show feedback section if we have any feedback
  const hasFeedback =
    allStrengths.length > 0 ||
    allWeaknesses.length > 0 ||
    allCorrections.length > 0 ||
    allActionPlan.length > 0;

  if (!hasFeedback) {
    feedbackSection.classList.add("hidden");
    return;
  }

  feedbackSection.classList.remove("hidden");

  // Display strengths
  displayFeedbackList("strengthsSection", "strengthsList", allStrengths);

  // Display weaknesses
  displayFeedbackList("weaknessesSection", "weaknessesList", allWeaknesses);

  // Display corrections
  displayFeedbackList("correctionsSection", "correctionsList", allCorrections);

  // Display action plan
  displayFeedbackList("actionPlanSection", "actionPlanList", allActionPlan);
}

/**
 * Display a feedback list
 */
function displayFeedbackList(
  sectionId: string,
  listId: string,
  items: string[],
) {
  const section = document.getElementById(sectionId) as HTMLDivElement;
  const list = document.getElementById(listId) as HTMLUListElement;

  if (items.length === 0) {
    section.style.display = "none";
    return;
  }

  section.style.display = "block";
  list.innerHTML = items.map((item) => `<li>${item}</li>`).join("");
}

/**
 * Clear all scores
 */
async function clearAllScores() {
  if (!confirm("Are you sure you want to clear all scores?")) {
    return;
  }

  chrome.storage.local.remove(["ieltsScores"], () => {
    console.log(`${LOG_PREFIX} Scores cleared`);
    loadScores();
  });
}

/**
 * Show status message
 */
function showStatus(
  element: HTMLElement,
  message: string,
  type: "success" | "error" | "info",
) {
  element.textContent = message;
  element.className = `status-message status-${type}`;
  element.classList.remove("hidden");

  setTimeout(() => {
    element.classList.add("hidden");
  }, 3000);
}
