import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function calculateScore({ isCorrect, responseTimeMs, timeLimitSeconds, pointsEnabled }) {
  if (!isCorrect || !pointsEnabled) return 0;
  const limitMs = Math.max(timeLimitSeconds, 1) * 1000;
  const elapsed = Math.min(Math.max(responseTimeMs, 0), limitMs);
  const speedRatio = 1 - elapsed / limitMs;
  return Math.max(100, Math.round(500 + speedRatio * 500));
}

test("fast correct answers receive more points than slow answers", () => {
  assert.ok(
    calculateScore({ isCorrect: true, responseTimeMs: 1000, timeLimitSeconds: 20, pointsEnabled: true }) >
      calculateScore({ isCorrect: true, responseTimeMs: 19000, timeLimitSeconds: 20, pointsEnabled: true }),
  );
});

test("wrong answers and disabled points award zero", () => {
  assert.equal(calculateScore({ isCorrect: false, responseTimeMs: 1000, timeLimitSeconds: 20, pointsEnabled: true }), 0);
  assert.equal(calculateScore({ isCorrect: true, responseTimeMs: 1000, timeLimitSeconds: 20, pointsEnabled: false }), 0);
});

test("question auto close does not use all participants answered", () => {
  const closeQuestionSource = readFileSync("src/lib/game/close-question.ts", "utf8");
  const answerRouteSource = readFileSync("src/app/api/games/[gameId]/answer/route.ts", "utf8");
  assert.equal(closeQuestionSource.includes("all_answered"), false);
  assert.equal(answerRouteSource.includes("all_answered"), false);
});

test("participant question api does not select visible question or answer text", () => {
  const questionRouteSource = readFileSync("src/app/api/games/[gameId]/question/route.ts", "utf8");
  assert.equal(questionRouteSource.includes("question_text"), false);
  assert.equal(questionRouteSource.includes("answer_text"), false);
});

test("participant submitted state renders a waiting screen instead of the answer grid", () => {
  const playClientSource = readFileSync("src/components/participant/play-client.tsx", "utf8");
  assert.ok(playClientSource.includes('snapshot.game.status === "QUESTION" && submitted'));
  assert.ok(playClientSource.includes('title="답변 완료!"'));
});

test("host question view uses a fullscreen presenter layout", () => {
  const gameControlSource = readFileSync("src/components/admin/game-control.tsx", "utf8");
  assert.ok(gameControlSource.includes("fixed inset-0"));
  assert.ok(gameControlSource.includes("overflow-hidden"));
  assert.ok(gameControlSource.includes("QuestionPresenterView"));
});

test("host answer cards center large answer text without changing participant labels", () => {
  const answerGridSource = readFileSync("src/components/game/answer-grid.tsx", "utf8");
  assert.ok(answerGridSource.includes("flex min-h-0 flex-col items-center justify-center"));
  assert.ok(answerGridSource.includes("text-[clamp(2rem,4vw,4.5rem)]"));
  assert.ok(answerGridSource.includes("text-[clamp(2rem,3.5vw,4rem)]"));
  assert.ok(answerGridSource.includes("[overflow-wrap:anywhere]"));
  assert.equal(answerGridSource.includes("layout.label}</button>"), false);
});

test("participant clients do not fan out auto-close writes", () => {
  const playClientSource = readFileSync("src/components/participant/play-client.tsx", "utf8");
  const questionRouteSource = readFileSync("src/app/api/games/[gameId]/question/route.ts", "utf8");
  assert.equal(playClientSource.includes("/auto-close"), false);
  assert.equal(questionRouteSource.includes("maybeCloseQuestion"), false);
});

test("answer submission uses database guardrails for duplicate and score updates", () => {
  const answerRouteSource = readFileSync("src/app/api/games/[gameId]/answer/route.ts", "utf8");
  const schemaSource = readFileSync("supabase/schema.sql", "utf8");
  assert.ok(schemaSource.includes("unique (game_id, question_id, participant_id)"));
  assert.ok(answerRouteSource.includes('rpc("increment_participant_score"'));
  assert.equal(answerRouteSource.includes("score: Number(participant.score) + scoreAwarded"), false);
});

test("deployment url and participant answer lookup index are documented", () => {
  const envExampleSource = readFileSync(".env.example", "utf8");
  const migrationSource = readFileSync("supabase/migrations/202609100003_deployment_readiness_indexes_and_score_rpc.sql", "utf8");
  assert.ok(envExampleSource.includes("NEXT_PUBLIC_APP_URL="));
  assert.ok(migrationSource.includes("participant_answers_participant_question_idx"));
});
