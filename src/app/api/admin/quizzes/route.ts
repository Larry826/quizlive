import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { jsonError, parseError } from "@/lib/http";
import { createServiceClient, hasSupabaseConfig } from "@/lib/supabase/server";
import { quizInputSchema } from "@/lib/validation/quiz";

export async function GET() {
  try {
    await requireAdmin();
    if (!hasSupabaseConfig()) {
      return NextResponse.json({ quizzes: [] });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("quizzes")
      .select("id,title,description,created_at,questions(id)")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ quizzes: data ?? [] });
  } catch (error) {
    return jsonError(parseError(error), error instanceof Error && error.message === "ADMIN_UNAUTHORIZED" ? 401 : 400);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const input = quizInputSchema.parse(await request.json());
    const supabase = createServiceClient();

    const { data: quiz, error: quizError } = await supabase
      .from("quizzes")
      .insert({ title: input.title, description: input.description })
      .select("id")
      .single();

    if (quizError || !quiz) {
      throw quizError || new Error("퀴즈를 저장하지 못했습니다.");
    }

    for (const [index, question] of input.questions.entries()) {
      const { data: createdQuestion, error: questionError } = await supabase
        .from("questions")
        .insert({
          quiz_id: quiz.id,
          order_index: index,
          question_text: question.text,
          time_limit: question.timeLimit,
          points_enabled: question.pointsEnabled,
        })
        .select("id")
        .single();

      if (questionError || !createdQuestion) {
        throw questionError || new Error("문제를 저장하지 못했습니다.");
      }

      const { error: answerError } = await supabase.from("answers").insert(
        question.answers.map((answer, answerIndex) => ({
          question_id: createdQuestion.id,
          answer_text: answer.text,
          answer_index: answerIndex,
          is_correct: answer.isCorrect,
        })),
      );

      if (answerError) {
        throw answerError;
      }
    }

    return NextResponse.json({ id: quiz.id }, { status: 201 });
  } catch (error) {
    return jsonError(parseError(error), error instanceof Error && error.message === "ADMIN_UNAUTHORIZED" ? 401 : 400);
  }
}

