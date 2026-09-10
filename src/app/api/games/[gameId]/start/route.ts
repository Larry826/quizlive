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
    const [participantResult, gameResult] = await Promise.all([
      supabase.from("participants").select("id", { count: "exact", head: true }).eq("game_id", gameId),
      supabase
        .from("games")
        .select("id,pin,quiz_id,status,current_question_index,question_started_at,question_starts_at,question_ends_at,quizzes(title,questions(id))")
        .eq("id", gameId)
        .single(),
    ]);
    const count = participantResult.count;
    if (!count) {
      return jsonError("참가자가 있어야 시작할 수 있습니다.", 409);
    }
    const game = gameResult.data;
    if (!game) return jsonError("게임을 찾을 수 없습니다.", 404);
    const { data: firstQuestion } = await supabase
      .from("questions")
      .select("id,order_index,question_text,time_limit,answers(id,answer_text,answer_index)")
      .eq("quiz_id", game.quiz_id)
      .eq("order_index", 0)
      .single();
    if (!firstQuestion) return jsonError("첫 문제를 찾을 수 없습니다.", 404);
    const transitionAt = new Date();
    const startsAt = new Date(transitionAt.getTime() + PREPARE_DELAY_MS);
    const questionEndsAt = new Date(startsAt.getTime() + Number(firstQuestion.time_limit) * 1000).toISOString();
    const { data: updatedGame, error } = await supabase
      .from("games")
      .update({
        status: "QUESTION",
        current_question_index: 0,
        started_at: transitionAt.toISOString(),
        question_started_at: transitionAt.toISOString(),
        question_starts_at: startsAt.toISOString(),
        question_ends_at: questionEndsAt,
      })
      .eq("id", gameId)
      .eq("status", "LOBBY")
      .select("id,pin,status,current_question_index,question_started_at,question_starts_at,question_ends_at,quizzes(title,questions(id))")
      .maybeSingle();
    if (error) {
      throw error;
    }
    if (!updatedGame) return jsonError("이미 시작되었거나 시작할 수 없는 게임입니다.", 409);

    const serverNow = new Date().toISOString();
    return NextResponse.json({
      ok: true,
      serverNow,
      snapshot: { game: updatedGame, serverNow },
      question: {
        status: updatedGame.status,
        questionStartedAt: updatedGame.question_started_at,
        questionStartsAt: updatedGame.question_starts_at,
        questionEndsAt: updatedGame.question_ends_at,
        serverNow,
        question: firstQuestion,
      },
    });
  } catch (error) {
    return jsonError(parseError(error), error instanceof Error && error.message === "ADMIN_UNAUTHORIZED" ? 401 : 400);
  }
}
