import type { QuizInput, QuizQuestionInput } from "@/types/quiz";

export function createEmptyQuestion(): QuizQuestionInput {
  return {
    text: "",
    timeLimit: 15,
    pointsEnabled: true,
    answers: [
      { text: "", isCorrect: true },
      { text: "", isCorrect: false },
      { text: "", isCorrect: false },
      { text: "", isCorrect: false },
    ],
  };
}

export function createEmptyQuiz(): QuizInput {
  return {
    title: "",
    description: "",
    questions: [createEmptyQuestion()],
  };
}
