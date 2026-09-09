import { notFound } from "next/navigation";
import { QuizForm } from "@/components/admin/quiz-form";
import { createServiceClient } from "@/lib/supabase/server";
import type { QuizInput } from "@/types/quiz";

type EditQuizRow = {
  id: string;
  title: string;
  description: string | null;
  questions: {
    id: string;
    order_index: number;
    question_text: string;
    time_limit: number;
    points_enabled: boolean;
    answers: {
      answer_text: string;
      answer_index: number;
      is_correct: boolean;
    }[];
  }[];
};

export default async function EditQuizPage({ params }: { params: Promise<{ quizId: string }> }) {
  const { quizId } = await params;
  const { data } = await createServiceClient()
    .from("quizzes")
    .select("id,title,description,questions(id,order_index,question_text,time_limit,points_enabled,answers(answer_text,answer_index,is_correct))")
    .eq("id", quizId)
    .single();

  if (!data) {
    notFound();
  }

  const row = data as EditQuizRow;
  const initialQuiz: QuizInput = {
    title: row.title,
    description: row.description ?? "",
    questions: row.questions
      .sort((first, second) => first.order_index - second.order_index)
      .map((question) => ({
        text: question.question_text,
        timeLimit: question.time_limit,
        pointsEnabled: question.points_enabled,
        answers: question.answers
          .sort((first, second) => first.answer_index - second.answer_index)
          .map((answer) => ({
            text: answer.answer_text,
            isCorrect: answer.is_correct,
          })),
      })),
  };

  return <QuizForm initialQuiz={initialQuiz} quizId={quizId} />;
}

