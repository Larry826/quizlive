export function calculateScore(params: {
  isCorrect: boolean;
  responseTimeMs: number;
  timeLimitSeconds: number;
  pointsEnabled: boolean;
}) {
  if (!params.isCorrect || !params.pointsEnabled) {
    return 0;
  }

  const limitMs = Math.max(params.timeLimitSeconds, 1) * 1000;
  const elapsed = Math.min(Math.max(params.responseTimeMs, 0), limitMs);
  const speedRatio = 1 - elapsed / limitMs;
  return Math.max(100, Math.round(500 + speedRatio * 500));
}

