// IELTS band calculation utilities

/**
 * Round to nearest 0.5 (IELTS band rounding)
 */
export function roundToNearestHalf(score: number): number {
  return Math.round(score * 2) / 2;
}

/**
 * Calculate Writing final band from Task 1 and Task 2 bands
 * Formula: (task1Band + task2Band * 2) / 3, rounded to nearest half
 */
export function calculateWritingBand(task1Band: number, task2Band: number): number {
  const weighted = (task1Band + task2Band * 2) / 3;
  return roundToNearestHalf(weighted);
}

/**
 * Calculate Speaking final band from four criteria
 * Formula: average of all four criteria, rounded to nearest half
 */
export function calculateSpeakingBand(
  fluencyAndCoherence: number,
  lexicalResource: number,
  grammaticalRangeAndAccuracy: number,
  pronunciation: number
): number {
  const average = (fluencyAndCoherence + lexicalResource + grammaticalRangeAndAccuracy + pronunciation) / 4;
  return roundToNearestHalf(average);
}

/**
 * Calculate overall IELTS band from four skills
 * Formula: average of Listening, Reading, Writing, Speaking, rounded to nearest half
 * Missing scores are excluded from the calculation
 */
export function calculateOverallBand(
  listening?: number,
  reading?: number,
  writing?: number,
  speaking?: number
): number | undefined {
  const scores = [listening, reading, writing, speaking].filter((s): s is number => s !== undefined);

  if (scores.length === 0) {
    return undefined;
  }

  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  return roundToNearestHalf(average);
}

/**
 * Calculate average of Task 1 criteria bands
 */
export function calculateTask1Band(
  taskAchievement: number,
  coherenceAndCohesion: number,
  lexicalResource: number,
  grammaticalRangeAndAccuracy: number
): number {
  const average = (taskAchievement + coherenceAndCohesion + lexicalResource + grammaticalRangeAndAccuracy) / 4;
  return roundToNearestHalf(average);
}

/**
 * Calculate average of Task 2 criteria bands
 */
export function calculateTask2Band(
  taskResponse: number,
  coherenceAndCohesion: number,
  lexicalResource: number,
  grammaticalRangeAndAccuracy: number
): number {
  const average = (taskResponse + coherenceAndCohesion + lexicalResource + grammaticalRangeAndAccuracy) / 4;
  return roundToNearestHalf(average);
}
