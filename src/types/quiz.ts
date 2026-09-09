export type GameStatus =
  | "LOBBY"
  | "QUESTION"
  | "QUESTION_RESULT"
  | "LEADERBOARD"
  | "FINISHED";

export type Difficulty = "easy" | "normal" | "hard";

export type QuizAnswerInput = {
  text: string;
  isCorrect: boolean;
};

export type QuizQuestionInput = {
  text: string;
  timeLimit: number;
  pointsEnabled: boolean;
  answers: QuizAnswerInput[];
};

export type QuizInput = {
  title: string;
  description: string;
  questions: QuizQuestionInput[];
};

export type PublicAnswer = {
  id: string;
  answerIndex: number;
  answerText: string;
};

export type PublicQuestion = {
  id: string;
  orderIndex: number;
  questionText: string;
  timeLimit: number;
  answers: PublicAnswer[];
};

export type LeaderboardEntry = {
  participantId: string;
  nickname: string;
  score: number;
  rank: number;
};

export type GameSnapshot = {
  id: string;
  pin: string;
  status: GameStatus;
  currentQuestionIndex: number;
  questionStartedAt: string | null;
  quizTitle: string;
  participantCount: number;
  questionsTotal: number;
};

