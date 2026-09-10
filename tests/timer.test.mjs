import assert from "node:assert/strict";
import test from "node:test";
import {
  createCountdownState,
  reconcileSubmittedAnswer,
  shouldApplyResponse,
  updateCountdownState,
} from "../src/lib/game/countdown.mjs";

const startsAt = "2026-09-10T00:00:00.000Z";
const endsAt = "2026-09-10T00:00:15.000Z";
const baseNow = new Date(startsAt).getTime();

function input(overrides = {}) {
  return {
    questionId: "question-1",
    startsAt,
    endsAt,
    timeLimitSeconds: 15,
    serverOffsetMs: 0,
    localNowMs: baseNow,
    graceMs: 1500,
    ...overrides,
  };
}

test("same-question clock refresh cannot increase the displayed countdown", () => {
  let state = createCountdownState(input());
  state = updateCountdownState(state, input({ localNowMs: baseNow + 2_001 }));
  assert.equal(state.remaining, 13);

  state = updateCountdownState(state, input({ localNowMs: baseNow + 1_001, serverOffsetMs: -800 }));
  assert.equal(state.remaining, 13);
  assert.equal(state.serverOffsetMs, 0);
});

test("absolute time produces a monotonic 15, 14, 13, 12 sequence", () => {
  let state = createCountdownState(input());
  const values = [state.remaining];
  for (const elapsed of [1_001, 2_001, 3_001]) {
    state = updateCountdownState(state, input({ localNowMs: baseNow + elapsed }));
    values.push(state.remaining);
  }
  assert.deepEqual(values, [15, 14, 13, 12]);
});

test("only the latest API response is accepted", () => {
  assert.equal(shouldApplyResponse(2, 2), true);
  assert.equal(shouldApplyResponse(1, 2), false);
});

test("a new question resets the countdown from its own immutable anchors", () => {
  let state = createCountdownState(input({ localNowMs: baseNow + 10_001 }));
  assert.equal(state.remaining, 5);

  const nextStart = baseNow + 30_000;
  state = updateCountdownState(
    state,
    input({
      questionId: "question-2",
      startsAt: new Date(nextStart).toISOString(),
      endsAt: new Date(nextStart + 15_000).toISOString(),
      localNowMs: nextStart,
    }),
  );
  assert.equal(state.remaining, 15);
  assert.equal(state.questionId, "question-2");
});

test("preparing enters active at the full question duration", () => {
  const delayedStart = baseNow + 2_000;
  let state = createCountdownState(
    input({
      startsAt: new Date(delayedStart).toISOString(),
      endsAt: new Date(delayedStart + 15_000).toISOString(),
    }),
  );
  assert.equal(state.phase, "preparing");
  assert.equal(state.remaining, 15);

  state = updateCountdownState(state, input({ localNowMs: delayedStart }));
  assert.equal(state.phase, "active");
  assert.equal(state.remaining, 15);
});

test("settling stays at zero even if the browser clock moves backward", () => {
  let state = createCountdownState(input({ localNowMs: baseNow + 14_999 }));
  assert.equal(state.remaining, 1);
  state = updateCountdownState(state, input({ localNowMs: baseNow + 15_000 }));
  assert.equal(state.phase, "settling");
  assert.equal(state.remaining, 0);

  state = updateCountdownState(state, input({ localNowMs: baseNow + 14_000 }));
  assert.equal(state.phase, "settling");
  assert.equal(state.remaining, 0);
});

test("an optimistic participant answer survives a same-question refresh", () => {
  assert.equal(
    reconcileSubmittedAnswer({
      currentQuestionId: "question-1",
      nextQuestionId: "question-1",
      optimisticAnswerId: "answer-2",
      serverAnswerId: null,
    }),
    "answer-2",
  );
});
