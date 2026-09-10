export type CountdownPhase = "preparing" | "active" | "settling" | "closed";

export type CountdownInput = {
  questionId: string;
  startsAt: string;
  endsAt: string;
  timeLimitSeconds: number;
  serverOffsetMs: number;
  localNowMs: number;
  graceMs?: number;
};

export type CountdownState = {
  questionId: string;
  startsAtMs: number;
  endsAtMs: number;
  timeLimitSeconds: number;
  serverOffsetMs: number;
  graceMs: number;
  phase: CountdownPhase;
  remaining: number;
};

export function estimateServerOffsetMs(
  serverNow: string,
  roundTripMs: number,
  receivedAtEpochMs: number,
): number;
export function shouldApplyResponse(responseRequestId: number, latestRequestId: number): boolean;
export function reconcileSubmittedAnswer(input: {
  currentQuestionId: string;
  nextQuestionId: string;
  optimisticAnswerId: string;
  serverAnswerId: string | null;
}): string;
export function createCountdownState(input: CountdownInput): CountdownState;
export function updateCountdownState(previous: CountdownState | null, input: CountdownInput): CountdownState;
