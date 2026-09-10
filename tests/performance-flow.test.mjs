import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("participant state refresh uses one endpoint and only the game realtime channel", () => {
  const source = readFileSync("src/components/participant/play-client.tsx", "utf8");
  assert.ok(source.includes("/question?participantId="));
  assert.equal(source.includes("/snapshot"), false);
  assert.equal(source.includes('table: "participant_answers"'), false);
  assert.ok(source.includes("latestRequestIdRef"));
  assert.ok(source.includes("AbortController"));
});

test("host answer events use the lightweight count endpoint", () => {
  const source = readFileSync("src/components/admin/game-control.tsx", "utf8");
  const route = readFileSync("src/app/api/games/[gameId]/answer-count/route.ts", "utf8");
  assert.ok(source.includes("/answer-count?questionId="));
  assert.ok(source.includes('event: "INSERT", schema: "public", table: "participant_answers"'));
  assert.ok(route.includes('select("id", { count: "exact", head: true })'));
});

test("start and next commands return the render-ready host payload", () => {
  for (const path of [
    "src/app/api/games/[gameId]/start/route.ts",
    "src/app/api/games/[gameId]/next/route.ts",
  ]) {
    const source = readFileSync(path, "utf8");
    assert.ok(source.includes("snapshot:"));
    assert.ok(source.includes("question:"));
    assert.ok(source.includes("serverNow"));
  }
});

test("answer submission crosses the Vercel to Supabase boundary once", () => {
  const source = readFileSync("src/app/api/games/[gameId]/answer/route.ts", "utf8");
  assert.equal((source.match(/\.rpc\(/g) ?? []).length, 1);
  assert.equal((source.match(/\.from\(/g) ?? []).length, 0);
  assert.ok(source.includes('rpc("submit_quiz_answer"'));
});
