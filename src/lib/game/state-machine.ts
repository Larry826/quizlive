import type { GameStatus } from "@/types/quiz";

const transitions: Record<GameStatus, GameStatus[]> = {
  LOBBY: ["QUESTION"],
  QUESTION: ["QUESTION_RESULT"],
  QUESTION_RESULT: ["LEADERBOARD", "QUESTION", "FINISHED"],
  LEADERBOARD: ["QUESTION", "FINISHED"],
  FINISHED: [],
};

export function canTransition(from: GameStatus, to: GameStatus) {
  return transitions[from].includes(to);
}

export function assertTransition(from: GameStatus, to: GameStatus) {
  if (!canTransition(from, to)) {
    throw new Error(`${from}에서 ${to} 상태로 이동할 수 없습니다.`);
  }
}

