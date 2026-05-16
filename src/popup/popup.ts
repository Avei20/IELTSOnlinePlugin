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
let currentScores: any = null;

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
    currentScores = response;
    displayScores(response);
  });
}

/**
 * Display scores in the UI
 */
function displayScores(scores: any) {
  if (Array.isArray(scores.tests) && scores.tests.length > 0) {
    displayScoreTable(scores.tests);
    displayFeedbackForTest(scores.tests[0]);
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
  displayFeedback(scores.details, scores.tests);
}

function displayScoreTable(tests: any[]) {
  scoresContainer.innerHTML = `
    <div class="table-wrap">
      <table class="scores-table">
        <thead>
          <tr>
            <th>Test</th>
            <th>L</th>
            <th>R</th>
            <th>W</th>
            <th>S</th>
            <th>Overall</th>
          </tr>
        </thead>
        <tbody>
          ${tests.map(renderTestRow).join("")}
        </tbody>
      </table>
    </div>
    <div class="table-hint">Click a row to view feedback. Use ↻ to rescore AI skills.</div>
  `;

  scoresContainer
    .querySelectorAll<HTMLButtonElement>(".rescore-btn")
    .forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        requestRescore(
          button.dataset.testId || "",
          button.dataset.skill as "writing" | "speaking",
        );
      });
    });

  scoresContainer
    .querySelectorAll<HTMLTableRowElement>("tbody tr")
    .forEach((row) => {
      row.addEventListener("click", () => {
        scoresContainer
          .querySelectorAll("tbody tr")
          .forEach((item) => item.classList.remove("selected"));
        row.classList.add("selected");
        displayFeedbackForTest(
          tests.find((test) => test.id === row.dataset.testId),
        );
      });
    });
}

function renderTestRow(test: any): string {
  return `
    <tr data-test-id="${escapeHtml(test.id)}">
      <td class="test-name-cell"><div class="test-name" title="${escapeHtml(test.testName)}">${escapeHtml(test.testName)}</div><div class="muted">${escapeHtml(test.date || "")}</div></td>
      <td>${renderBand(test.listening, test.status?.listening)}</td>
      <td>${renderBand(test.reading, test.status?.reading)}</td>
      <td>${renderBand(test.writing, test.status?.writing)}${renderRescoreButton(test, "writing")}</td>
      <td>${renderBand(test.speaking, test.status?.speaking)}${renderRescoreButton(test, "speaking")}</td>
      <td>${renderBand(test.overall)}</td>
    </tr>
  `;
}

function renderRescoreButton(test: any, skill: "writing" | "speaking"): string {
  if (!test.reviewUrls?.[skill]) return "";
  return `<button class="rescore-btn" data-test-id="${escapeHtml(test.id)}" data-skill="${skill}" title="Rescore ${skill}">↻</button>`;
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
function requestRescore(testId: string, skill: "writing" | "speaking") {
  if (!testId || !skill) return;
  chrome.runtime.sendMessage(
    { type: "RESCORE_TEST_SKILL", payload: { testId, skill } },
    (response) => {
      if (chrome.runtime.lastError || !response?.success) {
        console.error(
          `${LOG_PREFIX} Rescore failed:`,
          chrome.runtime.lastError || response,
        );
        return;
      }
      loadScores();
    },
  );
}

function displayFeedbackForTest(test: any) {
  if (!test) {
    feedbackSection.classList.add("hidden");
    return;
  }

  const sessions = collectFeedbackSessions(null, [test]);
  if (sessions.length === 0) {
    feedbackSection.classList.remove("hidden");
    feedbackSection.innerHTML = `
      <div class="section-title">Feedback</div>
      <div class="no-data">No feedback available for this test yet. Open the result pages or use AI rescore for Writing/Speaking.</div>
    `;
    return;
  }

  feedbackSection.classList.remove("hidden");
  feedbackSection.innerHTML = `
    <div class="section-title">${escapeHtml(test.testName || "Test Feedback")}</div>
    ${sessions.map(renderFeedbackSession).join("")}
  `;
}

function displayFeedback(details: any, tests: any[] = []) {
  const sessions = collectFeedbackSessions(details, tests);

  if (!details && sessions.length === 0) {
    feedbackSection.classList.add("hidden");
    return;
  }

  if (sessions.length > 0) {
    feedbackSection.classList.remove("hidden");
    feedbackSection.innerHTML = `
      <div class="section-title">Feedback & Action Plan</div>
      ${sessions.map(renderFeedbackSession).join("")}
    `;
    return;
  }

  // Collect all feedback from legacy top-level writing and speaking details
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
  const section = document.getElementById(sectionId) as HTMLDivElement | null;
  const list = document.getElementById(listId) as HTMLUListElement | null;
  if (!section || !list) return;

  if (items.length === 0) {
    section.style.display = "none";
    return;
  }

  section.style.display = "block";
  list.innerHTML = items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function collectFeedbackSessions(details: any, tests: any[]) {
  const sessions: Array<{
    title: string;
    skill: "Listening" | "Reading" | "Writing" | "Speaking";
    band?: number;
    score: any;
  }> = [];

  for (const test of tests || []) {
    for (const skill of ["listening", "reading"] as const) {
      const score = test.objectiveDetails?.[skill]?.aiFeedback;
      if (!hasScoreFeedback(score)) continue;
      sessions.push({
        title: test.testName || "IELTS test",
        skill: skill === "listening" ? "Listening" : "Reading",
        band: test[skill],
        score,
      });
    }

    for (const skill of ["writing", "speaking"] as const) {
      const score = test.aiDetails?.[skill];
      if (!hasScoreFeedback(score)) continue;
      sessions.push({
        title: test.testName || "IELTS test",
        skill: skill === "writing" ? "Writing" : "Speaking",
        band: test[skill],
        score,
      });
    }
  }

  if (sessions.length === 0) {
    for (const skill of ["listening", "reading"] as const) {
      const detail = details?.[skill];
      const score = detail?.aiFeedback;
      if (!hasScoreFeedback(score)) continue;
      sessions.push({
        title: "Latest result",
        skill: skill === "listening" ? "Listening" : "Reading",
        band: detail.platformBand,
        score,
      });
    }

    for (const skill of ["writing", "speaking"] as const) {
      const score = details?.[skill];
      if (!hasScoreFeedback(score)) continue;
      sessions.push({
        title: "Latest result",
        skill: skill === "writing" ? "Writing" : "Speaking",
        band: score.overallBand,
        score,
      });
    }
  }

  return sessions;
}

function hasScoreFeedback(score: any): boolean {
  return Boolean(
    score &&
    ((score.strengths || []).length > 0 ||
      (score.weaknesses || []).length > 0 ||
      (score.corrections || []).length > 0 ||
      (score.actionPlan || []).length > 0),
  );
}

function renderFeedbackSession(session: {
  title: string;
  skill: "Listening" | "Reading" | "Writing" | "Speaking";
  band?: number;
  score: any;
}): string {
  const band =
    typeof session.band === "number"
      ? ` · Band ${session.band.toFixed(1)}`
      : "";
  return `
    <div class="feedback-session">
      <h4 style="font-size: 13px; color: #333; margin: 12px 0 6px">
        ${escapeHtml(session.title)} · ${session.skill}${band}
      </h4>
      ${renderFeedbackGroup("✓ Strengths", session.score.strengths, "#4caf50")}
      ${renderFeedbackGroup("✗ Weaknesses", session.score.weaknesses, "#f44336")}
      ${renderFeedbackGroup("✎ Corrections", session.score.corrections, "#ff9800")}
      ${renderFeedbackGroup("→ Action Plan", session.score.actionPlan, "#2196f3")}
    </div>
  `;
}

function renderFeedbackGroup(
  title: string,
  items: string[] = [],
  color: string,
): string {
  if (items.length === 0) return "";
  return `
    <div class="feedback-section">
      <h4 style="font-size: 13px; color: ${color}; margin-bottom: 8px">${title}</h4>
      <ul class="feedback-list">
        ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
    </div>
  `;
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
