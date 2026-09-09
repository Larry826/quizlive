import { ANSWER_LAYOUT } from "@/lib/game/answer-layout";

export const ANSWER_LABELS = ANSWER_LAYOUT.map((item) => item.label);

export const ANSWER_COLORS = ANSWER_LAYOUT.map((item) => item.hostClass);

export const GAME_STATUSES = [
  "LOBBY",
  "QUESTION",
  "QUESTION_RESULT",
  "LEADERBOARD",
  "FINISHED",
] as const;
