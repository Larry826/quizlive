import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { PREPARE_DELAY_MS } from "@/lib/game/constants";
import { jsonError, parseError } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(_request: NextRequest, context: { params: Promise<{ gameId: string }> }) {
  try {
    await requireAdmin();
    const { gameId } = await context.params;
    const supabase = createServiceClient();
    const { data: game } = await supabase
      .from("games")
      .select("id,pin,quiz_id,status,current_question_index,question_started_at,question_starts_at,question_ends_at,quizzes(title,questions(id))")
      .eq("id", gameId)
      .single();
    if (!game) {
      return jsonError("게임을 찾을 수 없습니다.", 404);
    }
    if (game.status !== "QUESTION_RESULT" && game.status !== "LEADERBOARD") {
      return jsonError("지금은 다음 문제로 이동할 수 없습니다.", 409);
    }
    const questions = Array.isArray(game.quizzes)
      ? game.quizzes[0]?.questions
      : (game.quizzes as { questions?: { id: string }[] } | null)?.questions;
    const questionCount = questions?.length ?? 0;
    const nextIndex = Number(game.current_question_index) + 1;
    const finished = nextIndex >= questionCount;
    const transitionAt = new Date();
    const startsAt = new Date(transitionAt.getTime() + PREPARE_DELAY_MS);
    let questionEndsAt: string | null = null;
    let nextQuestion: {
      id: string;
      order_index: number;
      question_text: string;
      time_limit: number;
      answers: { id: string; answer_text: string; answer_index: number }[];
    } | null = null;
    if (!finished) {
      const { data } = await supabase
        .from("questions")
        .select("id,order_index,question_text,time_limit,answers(id,answer_text,answer_index)")
        .eq("quiz_id", game.quiz_id)
        .eq("order_index", nextIndex)
        .single();
      if (!data) return jsonError("다음 문제를 찾을 수 없습니다.", 404);
      nextQuestion = data;
      questionEndsAt = new Date(startsAt.getTime() + Number(data.time_limit) * 1000).toISOString();
    }
    const { data: updatedGame, error } = await supabase
      .from("games")
      .update({
        status: finished ? "FINISHED" : "QUESTION",
        current_question_index: finished ? game.current_question_index : nextIndex,
        ended_at: finished ? transitionAt.toISOString() : null,
        question_started_at: finished ? null : transitionAt.toISOString(),
        question_starts_at: finished ? null : startsAt.toISOString(),
        question_ends_at: questionEndsAt,
      })
      .eq("id", gameId)
      .in("status", ["QUESTION_RESULT", "LEADERBOARD"])
      .select("id,pin,status,current_question_index,question_started_at,question_starts_at,question_ends_at,quizzes(title,questions(id))")
      .maybeSingle();
    if (error) {
      throw error;
    }
    if (!updatedGame) return jsonError("게임 상태가 이미 변경되었습니다.", 409);

    const serverNow = new Date().toISOString();
    return NextResponse.json({
      finished,
      serverNow,
      snapshot: { game: updatedGame, serverNow },
      question: nextQuestion
        ? {
            status: updatedGame.status,
            questionStartedAt: updatedGame.question_started_at,
            questionStartsAt: updatedGame.question_starts_at,
            questionEndsAt: updatedGame.question_ends_at,
            serverNow,
            question: nextQuestion,
          }
        : null,
    });
  } catch (error) {
    return jsonError(parseError(error), error instanceof Error && error.message === "ADMIN_UNAUTHORIZED" ? 401 : 400);
  }
}
