import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { jsonError, parseError } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/server";
import { quizInputSchema } from "@/lib/validation/quiz";

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ quizId: string }> },
) {
  try {
    await requireAdmin();
    const { quizId } = await context.params;
    const input = quizInputSchema.parse(await request.json());
    const supabase = createServiceClient();

    const { error: quizError } = await supabase
      .from("quizzes")
      .update({ title: input.title, description: input.description, updated_at: new Date().toISOString() })
      .eq("id", quizId);
    if (quizError) {
      throw quizError;
    }

    const { data: existingQuestions, error: listError } = await supabase
      .from("questions")
      .select("id")
      .eq("quiz_id", quizId);
    if (listError) {
      throw listError;
    }

    const questionIds = (existingQuestions ?? []).map((question) => question.id as string);
    if (questionIds.length > 0) {
      await supabase.from("answers").delete().in("question_id", questionIds);
      await supabase.from("questions").delete().eq("quiz_id", quizId);
    }

    for (const [index, question] of input.questions.entries()) {
      const { data: createdQuestion, error: questionError } = await supabase
        .from("questions")
        .insert({
          quiz_id: quizId,
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

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(parseError(error), error instanceof Error && error.message === "ADMIN_UNAUTHORIZED" ? 401 : 400);
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ quizId: string }> },
) {
  try {
    await requireAdmin();
    const { quizId } = await context.params;
    const { error } = await createServiceClient().from("quizzes").delete().eq("id", quizId);
    if (error) {
      throw error;
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(parseError(error), error instanceof Error && error.message === "ADMIN_UNAUTHORIZED" ? 401 : 400);
  }
}

