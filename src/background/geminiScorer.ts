// Gemini AI scorer for Writing and Speaking
import {
  WritingResult,
  SpeakingResult,
  ObjectiveResult,
  AiIeltsScore,
  ConstructiveFeedback,
  WritingTask1Bands,
  WritingTask2Bands,
  SpeakingBands,
} from "../shared/types";
import {
  calculateWritingBand,
  calculateSpeakingBand,
  calculateTask1Band,
  calculateTask2Band,
} from "../shared/ieltsMath";

const LOG_PREFIX = "[IELTSPlugin]";

// Gemini API configuration
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * Get Gemini API key from storage
 */
async function getApiKey(): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(["geminiApiKey"], (result) => {
      resolve(result.geminiApiKey || null);
    });
  });
}

/**
 * Score writing result using Gemini AI
 */
export async function scoreWriting(
  writingResult: WritingResult,
): Promise<AiIeltsScore | null> {
  console.log(`${LOG_PREFIX} Scoring writing result`);

  const apiKey = await getApiKey();
  if (!apiKey) {
    console.error(
      `${LOG_PREFIX} Gemini API key not found. Please set it in the extension popup.`,
    );
    return null;
  }

  try {
    // Create prompt for Gemini
    const prompt = createWritingPrompt(writingResult);

    // Call Gemini API
    const response = await callGemini(
      apiKey,
      prompt,
      getWritingResponseSchema(),
    );

    if (!response) {
      console.error(`${LOG_PREFIX} Failed to get response from Gemini`);
      return null;
    }

    // Parse and validate response
    const score = parseWritingScore(response);

    if (!score) {
      console.error(
        `${LOG_PREFIX} Failed to parse writing score from Gemini response`,
      );
      return null;
    }

    console.log(`${LOG_PREFIX} Writing scored successfully:`, score);
    return score;
  } catch (error) {
    console.error(`${LOG_PREFIX} Error scoring writing:`, error);
    return null;
  }
}

/**
 * Score speaking result using Gemini AI
 */
export async function scoreSpeaking(
  speakingResult: SpeakingResult,
): Promise<AiIeltsScore | null> {
  console.log(`${LOG_PREFIX} Scoring speaking result`);

  const apiKey = await getApiKey();
  if (!apiKey) {
    console.error(
      `${LOG_PREFIX} Gemini API key not found. Please set it in the extension popup.`,
    );
    return null;
  }

  try {
    // Create prompt for Gemini
    const prompt = createSpeakingPrompt(speakingResult);

    // Call Gemini API
    const audioParts = await buildSpeakingAudioParts(speakingResult);
    const response = await callGemini(
      apiKey,
      prompt,
      getSpeakingResponseSchema(),
      audioParts,
    );

    if (!response) {
      console.error(`${LOG_PREFIX} Failed to get response from Gemini`);
      return null;
    }

    // Parse and validate response
    const score = parseSpeakingScore(response);

    if (!score) {
      console.error(
        `${LOG_PREFIX} Failed to parse speaking score from Gemini response`,
      );
      return null;
    }

    console.log(`${LOG_PREFIX} Speaking scored successfully:`, score);
    return score;
  } catch (error) {
    console.error(`${LOG_PREFIX} Error scoring speaking:`, error);
    return null;
  }
}

export async function createObjectiveFeedback(
  result: ObjectiveResult,
): Promise<ConstructiveFeedback | null> {
  if (!result.platformFeedback) return null;

  const apiKey = await getApiKey();
  if (!apiKey) {
    console.error(
      `${LOG_PREFIX} Gemini API key not found. Please set it in the extension popup.`,
    );
    return null;
  }

  try {
    console.log(
      `${LOG_PREFIX} Creating ${result.resultType} constructive feedback`,
      {
        band: result.platformBand,
        feedbackLength: result.platformFeedback.length,
      },
    );
    const response = await callGemini(
      apiKey,
      createObjectiveFeedbackPrompt(result),
      getObjectiveFeedbackSchema(),
    );
    return parseConstructiveFeedback(response);
  } catch (error) {
    console.error(`${LOG_PREFIX} Error creating objective feedback:`, error);
    return null;
  }
}

/**
 * Call Gemini API with structured output
 */
async function callGemini(
  apiKey: string,
  prompt: string,
  responseSchema: any,
  extraParts: any[] = [],
): Promise<any> {
  const url = `${GEMINI_API_ENDPOINT}?key=${apiKey}`;

  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: prompt,
          },
          ...extraParts,
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
      responseSchema,
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(
      `Gemini API error: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();

  const candidate = data.candidates?.[0];
  console.log(`${LOG_PREFIX} Gemini finish reason:`, candidate?.finishReason);

  // Extract text from response
  const text = candidate?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("No text in Gemini response");
  }

  console.log(`${LOG_PREFIX} Gemini raw response length:`, text.length);
  return parseGeminiJson(text);
}

function parseGeminiJson(text: string): any {
  const candidates = [text, text.replace(/```json|```/gi, "").trim()];

  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch) candidates.push(objectMatch[0]);

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      const repaired = candidate
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[,{]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":')
        .replace(/,\s*([}\]])/g, "$1");
      try {
        return JSON.parse(repaired);
      } catch {
        // Try next candidate.
      }
    }
  }

  console.error(
    `${LOG_PREFIX} Gemini raw response was not valid JSON:`,
    text.slice(0, 1000),
  );
  throw new SyntaxError("Gemini returned invalid JSON");
}

async function buildSpeakingAudioParts(
  speakingResult: SpeakingResult,
): Promise<any[]> {
  const parts: any[] = [];

  for (const part of speakingResult.parts) {
    if (!part.audioUrl) continue;
    try {
      console.log(
        `${LOG_PREFIX} Fetching speaking audio part ${part.partNumber}:`,
        part.audioUrl,
      );
      const response = await fetch(part.audioUrl);
      if (!response.ok)
        throw new Error(`Audio fetch failed: ${response.status}`);
      const contentType =
        response.headers.get("content-type") ||
        inferAudioMimeType(part.audioUrl);
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > 20 * 1024 * 1024) {
        console.warn(
          `${LOG_PREFIX} Skipping audio part ${part.partNumber}; file is over 20MB`,
        );
        continue;
      }
      parts.push({
        inlineData: {
          mimeType: contentType,
          data: arrayBufferToBase64(buffer),
        },
      });
    } catch (error) {
      console.error(
        `${LOG_PREFIX} Failed to attach speaking audio part ${part.partNumber}:`,
        error,
      );
    }
  }

  console.log(`${LOG_PREFIX} Attached speaking audio parts:`, parts.length);
  return parts;
}

function inferAudioMimeType(url: string): string {
  if (url.endsWith(".wav")) return "audio/wav";
  if (url.endsWith(".m4a")) return "audio/mp4";
  if (url.endsWith(".webm")) return "audio/webm";
  return "audio/mp3";
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function getObjectiveFeedbackSchema(): any {
  return {
    type: "OBJECT",
    properties: {
      strengths: stringArraySchema(),
      weaknesses: stringArraySchema(),
      corrections: stringArraySchema(),
      actionPlan: stringArraySchema(),
      confidence: { type: "NUMBER" },
    },
    required: [
      "strengths",
      "weaknesses",
      "corrections",
      "actionPlan",
      "confidence",
    ],
  };
}

function getWritingResponseSchema(): any {
  return {
    type: "OBJECT",
    properties: {
      task1: {
        type: "OBJECT",
        properties: bandProperties([
          "taskAchievement",
          "coherenceAndCohesion",
          "lexicalResource",
          "grammaticalRangeAndAccuracy",
        ]),
        required: [
          "taskAchievement",
          "coherenceAndCohesion",
          "lexicalResource",
          "grammaticalRangeAndAccuracy",
        ],
      },
      task2: {
        type: "OBJECT",
        properties: bandProperties([
          "taskResponse",
          "coherenceAndCohesion",
          "lexicalResource",
          "grammaticalRangeAndAccuracy",
        ]),
        required: [
          "taskResponse",
          "coherenceAndCohesion",
          "lexicalResource",
          "grammaticalRangeAndAccuracy",
        ],
      },
      strengths: stringArraySchema(),
      weaknesses: stringArraySchema(),
      corrections: stringArraySchema(),
      actionPlan: stringArraySchema(),
      confidence: { type: "NUMBER" },
    },
    required: [
      "task1",
      "task2",
      "strengths",
      "weaknesses",
      "corrections",
      "actionPlan",
      "confidence",
    ],
  };
}

function getSpeakingResponseSchema(): any {
  return {
    type: "OBJECT",
    properties: {
      ...bandProperties([
        "fluencyAndCoherence",
        "lexicalResource",
        "grammaticalRangeAndAccuracy",
        "pronunciation",
      ]),
      strengths: stringArraySchema(),
      weaknesses: stringArraySchema(),
      corrections: stringArraySchema(),
      actionPlan: stringArraySchema(),
      confidence: { type: "NUMBER" },
    },
    required: [
      "fluencyAndCoherence",
      "lexicalResource",
      "grammaticalRangeAndAccuracy",
      "pronunciation",
      "strengths",
      "weaknesses",
      "corrections",
      "actionPlan",
      "confidence",
    ],
  };
}

function bandProperties(names: string[]): Record<string, any> {
  return names.reduce(
    (schema, name) => {
      schema[name] = { type: "NUMBER" };
      return schema;
    },
    {} as Record<string, any>,
  );
}

function stringArraySchema(): any {
  return { type: "ARRAY", items: { type: "STRING" } };
}

function createObjectiveFeedbackPrompt(result: ObjectiveResult): string {
  return `You are an IELTS coach. Convert this IELTS ${result.resultType} platform Band Score feedback into concise constructive training feedback.

Band: ${result.platformBand}
Raw score: ${result.rawScore || "Unavailable"}
Platform feedback: ${result.platformFeedback}

Return JSON only. Do not change the score. Keep strengths, weaknesses, corrections, and actionPlan to maximum 2 short strings each. Make the action plan specific and practical.`;
}

/**
 * Create prompt for writing scoring
 */
function createWritingPrompt(writingResult: WritingResult): string {
  return `You are an IELTS Writing examiner. Score the following IELTS Writing test according to official IELTS band descriptors.

TASK 1:
Question: ${writingResult.task1Question}

Answer: ${writingResult.task1Answer}

TASK 2:
Question: ${writingResult.task2Question}

Answer: ${writingResult.task2Answer}

Return JSON only. Score each criterion from 0 to 9 in 0.5 increments.
Keep strengths, weaknesses, corrections, and actionPlan to maximum 2 short strings each.
Confidence must be a number from 0 to 1.`;
}

/**
 * Create prompt for speaking scoring
 */
function createSpeakingPrompt(speakingResult: SpeakingResult): string {
  const partsText = speakingResult.parts
    .map((part) => {
      let text = `PART ${part.partNumber}:\n`;
      text += `Questions: ${part.questions.join("; ")}\n`;
      if (part.transcript) {
        text += `Transcript: ${part.transcript}\n`;
      }
      return text;
    })
    .join("\n");

  return `You are an IELTS Speaking examiner. Score the following IELTS Speaking test according to official IELTS band descriptors.

${partsText}

The user's audio recordings are attached in Part 1, Part 2, Part 3 order. Evaluate pronunciation from the audio and infer fluency from pauses/hesitations.
Return JSON only. Score each criterion from 0 to 9 in 0.5 increments.
Keep strengths, weaknesses, corrections, and actionPlan to maximum 2 short strings each.
Confidence must be a number from 0 to 1.`;
}

function parseConstructiveFeedback(response: any): ConstructiveFeedback {
  return {
    strengths: Array.isArray(response.strengths) ? response.strengths : [],
    weaknesses: Array.isArray(response.weaknesses) ? response.weaknesses : [],
    corrections: Array.isArray(response.corrections)
      ? response.corrections
      : [],
    actionPlan: Array.isArray(response.actionPlan) ? response.actionPlan : [],
    confidence:
      typeof response.confidence === "number" ? response.confidence : 0.5,
  };
}

/**
 * Parse and validate writing score from Gemini response
 */
function parseWritingScore(response: any): AiIeltsScore | null {
  try {
    // Validate task1 bands
    const task1: WritingTask1Bands = {
      taskAchievement: validateBand(response.task1?.taskAchievement),
      coherenceAndCohesion: validateBand(response.task1?.coherenceAndCohesion),
      lexicalResource: validateBand(response.task1?.lexicalResource),
      grammaticalRangeAndAccuracy: validateBand(
        response.task1?.grammaticalRangeAndAccuracy,
      ),
    };

    // Validate task2 bands
    const task2: WritingTask2Bands = {
      taskResponse: validateBand(response.task2?.taskResponse),
      coherenceAndCohesion: validateBand(response.task2?.coherenceAndCohesion),
      lexicalResource: validateBand(response.task2?.lexicalResource),
      grammaticalRangeAndAccuracy: validateBand(
        response.task2?.grammaticalRangeAndAccuracy,
      ),
    };

    // Calculate task bands
    const task1Band = calculateTask1Band(
      task1.taskAchievement,
      task1.coherenceAndCohesion,
      task1.lexicalResource,
      task1.grammaticalRangeAndAccuracy,
    );

    const task2Band = calculateTask2Band(
      task2.taskResponse,
      task2.coherenceAndCohesion,
      task2.lexicalResource,
      task2.grammaticalRangeAndAccuracy,
    );

    // Calculate overall writing band
    const overallBand = calculateWritingBand(task1Band, task2Band);

    return {
      overallBand,
      criteriaBands: { task1, task2 },
      strengths: Array.isArray(response.strengths) ? response.strengths : [],
      weaknesses: Array.isArray(response.weaknesses) ? response.weaknesses : [],
      corrections: Array.isArray(response.corrections)
        ? response.corrections
        : [],
      actionPlan: Array.isArray(response.actionPlan) ? response.actionPlan : [],
      confidence:
        typeof response.confidence === "number" ? response.confidence : 0.5,
    };
  } catch (error) {
    console.error(`${LOG_PREFIX} Error parsing writing score:`, error);
    return null;
  }
}

/**
 * Parse and validate speaking score from Gemini response
 */
function parseSpeakingScore(response: any): AiIeltsScore | null {
  try {
    // Validate speaking bands
    const bands: SpeakingBands = {
      fluencyAndCoherence: validateBand(response.fluencyAndCoherence),
      lexicalResource: validateBand(response.lexicalResource),
      grammaticalRangeAndAccuracy: validateBand(
        response.grammaticalRangeAndAccuracy,
      ),
      pronunciation: validateBand(response.pronunciation),
    };

    // Calculate overall speaking band
    const overallBand = calculateSpeakingBand(
      bands.fluencyAndCoherence,
      bands.lexicalResource,
      bands.grammaticalRangeAndAccuracy,
      bands.pronunciation,
    );

    return {
      overallBand,
      criteriaBands: bands,
      strengths: Array.isArray(response.strengths) ? response.strengths : [],
      weaknesses: Array.isArray(response.weaknesses) ? response.weaknesses : [],
      corrections: Array.isArray(response.corrections)
        ? response.corrections
        : [],
      actionPlan: Array.isArray(response.actionPlan) ? response.actionPlan : [],
      confidence:
        typeof response.confidence === "number" ? response.confidence : 0.5,
    };
  } catch (error) {
    console.error(`${LOG_PREFIX} Error parsing speaking score:`, error);
    return null;
  }
}

/**
 * Validate that a band score is valid (0-9 in 0.5 increments)
 */
function validateBand(value: any): number {
  const num = typeof value === "number" ? value : parseFloat(value);

  if (isNaN(num) || num < 0 || num > 9) {
    throw new Error(`Invalid band score: ${value}`);
  }

  // Round to nearest 0.5
  return Math.round(num * 2) / 2;
}
