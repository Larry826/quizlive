/**
 * Estimate the difference between the server clock and the browser clock.
 * `serverNow` is emitted immediately before the response is sent, so half of
 * the measured round trip is added to approximate server time on receipt.
 */
export function estimateServerOffsetMs(serverNow, roundTripMs, receivedAtEpochMs) {
  const serverNowMs = new Date(serverNow).getTime();
  if (!Number.isFinite(serverNowMs)) return 0;
  return serverNowMs + Math.max(0, roundTripMs) / 2 - receivedAtEpochMs;
}

export function shouldApplyResponse(responseRequestId, latestRequestId) {
  return responseRequestId === latestRequestId;
}

export function reconcileSubmittedAnswer(input) {
  if (input.currentQuestionId !== input.nextQuestionId) return input.serverAnswerId ?? "";
  return input.optimisticAnswerId || input.serverAnswerId || "";
}

function phaseAt(effectiveNowMs, startsAtMs, endsAtMs, graceMs) {
  if (effectiveNowMs < startsAtMs) return "preparing";
  if (effectiveNowMs < endsAtMs) return "active";
  if (effectiveNowMs < endsAtMs + graceMs) return "settling";
  return "closed";
}

function remainingAt(phase, effectiveNowMs, endsAtMs, timeLimitSeconds) {
  if (phase === "preparing") return timeLimitSeconds;
  if (phase !== "active") return 0;
  return Math.max(0, Math.ceil((endsAtMs - effectiveNowMs) / 1000));
}

export function createCountdownState(input) {
  const startsAtMs = new Date(input.startsAt).getTime();
  const endsAtMs = new Date(input.endsAt).getTime();
  const timeLimitSeconds = Math.max(0, Number(input.timeLimitSeconds) || 0);
  const serverOffsetMs = Number.isFinite(input.serverOffsetMs) ? input.serverOffsetMs : 0;
  const graceMs = Math.max(0, Number(input.graceMs) || 0);
  const effectiveNowMs = input.localNowMs + serverOffsetMs;
  const phase = phaseAt(effectiveNowMs, startsAtMs, endsAtMs, graceMs);

  return {
    questionId: input.questionId,
    startsAtMs,
    endsAtMs,
    timeLimitSeconds,
    serverOffsetMs,
    graceMs,
    phase,
    remaining: remainingAt(phase, effectiveNowMs, endsAtMs, timeLimitSeconds),
  };
}

/**
 * A question's timing anchors and initial clock offset are immutable. Later
 * refresh samples can only advance the display; they can never move it back.
 */
export function updateCountdownState(previous, input) {
  if (!previous || previous.questionId !== input.questionId) {
    return createCountdownState(input);
  }

  const effectiveNowMs = input.localNowMs + previous.serverOffsetMs;
  const computedPhase = phaseAt(effectiveNowMs, previous.startsAtMs, previous.endsAtMs, previous.graceMs);
  const phaseOrder = { preparing: 0, active: 1, settling: 2, closed: 3 };
  const phase = phaseOrder[computedPhase] < phaseOrder[previous.phase] ? previous.phase : computedPhase;
  const computedRemaining = remainingAt(
    phase,
    effectiveNowMs,
    previous.endsAtMs,
    previous.timeLimitSeconds,
  );
  const remaining = Math.min(previous.remaining, computedRemaining);

  if (phase === previous.phase && remaining === previous.remaining) return previous;
  return { ...previous, phase, remaining };
}
