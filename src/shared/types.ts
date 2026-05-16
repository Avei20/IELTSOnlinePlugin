// Core data types for IELTS Plugin

export type ResultType = "reading" | "listening" | "writing" | "speaking";

export interface PracticeAttempt {
  resultType: ResultType;
  title: string;
  resultUrl: string;
  date: string;
  platformBand?: number;
}

export interface WritingResult {
  url: string;
  title: string;
  task1Question: string;
  task1Answer: string;
  task2Question: string;
  task2Answer: string;
}

export interface SpeakingResult {
  url: string;
  title: string;
  parts: SpeakingPart[];
}

export interface SpeakingPart {
  partNumber: number;
  questions: string[];
  transcript?: string;
  audioUrl?: string;
}

export interface ConstructiveFeedback {
  strengths: string[];
  weaknesses: string[];
  corrections: string[];
  actionPlan: string[];
  confidence: number;
}

export interface ObjectiveResult {
  url: string;
  title: string;
  resultType: "reading" | "listening";
  platformBand: number;
  rawScore?: string;
  platformFeedback?: string;
  aiFeedback?: ConstructiveFeedback;
}

// Writing criteria bands
export interface WritingTask1Bands {
  taskAchievement: number;
  coherenceAndCohesion: number;
  lexicalResource: number;
  grammaticalRangeAndAccuracy: number;
}

export interface WritingTask2Bands {
  taskResponse: number;
  coherenceAndCohesion: number;
  lexicalResource: number;
  grammaticalRangeAndAccuracy: number;
}

// Speaking criteria bands
export interface SpeakingBands {
  fluencyAndCoherence: number;
  lexicalResource: number;
  grammaticalRangeAndAccuracy: number;
  pronunciation: number;
}

export interface AiIeltsScore {
  overallBand: number;
  criteriaBands:
    | WritingTask1Bands
    | WritingTask2Bands
    | SpeakingBands
    | { task1: WritingTask1Bands; task2: WritingTask2Bands };
  strengths: string[];
  weaknesses: string[];
  corrections: string[];
  actionPlan: string[];
  confidence: number;
}

export interface IeltsTestScoreRow {
  id: string;
  testName: string;
  date?: string;
  listening?: number;
  reading?: number;
  writing?: number;
  speaking?: number;
  overall?: number;
  reviewUrls: Partial<Record<ResultType, string>>;
  sources: Partial<Record<ResultType, "platform" | "ai">>;
  status?: Partial<
    Record<
      ResultType,
      "pending" | "scoring" | "scored" | "error" | "unavailable"
    >
  >;
  aiDetails?: Partial<
    Record<Extract<ResultType, "writing" | "speaking">, AiIeltsScore>
  >;
  objectiveDetails?: Partial<
    Record<Extract<ResultType, "reading" | "listening">, ObjectiveResult>
  >;
}

export interface CombinedIeltsScore {
  listening?: number;
  reading?: number;
  writing?: number;
  speaking?: number;
  overall?: number;
  tests?: IeltsTestScoreRow[];
  sources: {
    listening?: "platform" | "ai";
    reading?: "platform" | "ai";
    writing?: "platform" | "ai";
    speaking?: "platform" | "ai";
  };
  details?: {
    listening?: ObjectiveResult;
    reading?: ObjectiveResult;
    writing?: AiIeltsScore;
    speaking?: AiIeltsScore;
  };
  aiScoreCache?: Partial<
    Record<
      Extract<ResultType, "writing" | "speaking">,
      Record<string, AiIeltsScore>
    >
  >;
}

// Message types for chrome.runtime.sendMessage
export type MessageType =
  | "WRITING_RESULT_SCRAPED"
  | "SPEAKING_RESULT_SCRAPED"
  | "OBJECTIVE_RESULT_SCRAPED"
  | "HISTORY_SCORES_SCRAPED"
  | "HISTORY_TESTS_SCRAPED"
  | "SCORE_WRITING"
  | "SCORE_SPEAKING"
  | "GET_COMBINED_SCORE"
  | "RESCORE_TEST_SKILL";

export interface Message {
  type: MessageType;
  payload?: any;
}

export interface WritingResultMessage extends Message {
  type: "WRITING_RESULT_SCRAPED";
  payload: WritingResult;
}

export interface SpeakingResultMessage extends Message {
  type: "SPEAKING_RESULT_SCRAPED";
  payload: SpeakingResult;
}

export interface ObjectiveResultMessage extends Message {
  type: "OBJECTIVE_RESULT_SCRAPED";
  payload: ObjectiveResult;
}
