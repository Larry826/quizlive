import { ANSWER_LAYOUT } from "@/lib/game/answer-layout";

export const ANSWER_LABELS = ANSWER_LAYOUT.map((item) => item.label);

export const ANSWER_COLORS = ANSWER_LAYOUT.map((item) => item.hostClass);

export const PREPARE_DELAY_MS = 2000;

export const ANSWER_NETWORK_GRACE_MS = 1500;

export const GAME_STATUSES = [
  "LOBBY",
  "QUESTION",
  "QUESTION_RESULT",
  "LEADERBOARD",
  "FINISHED",
] as const;
