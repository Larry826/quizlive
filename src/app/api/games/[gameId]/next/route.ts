import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { jsonError, parseError } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(_request: NextRequest, context: { params: Promise<{ gameId: string }> }) {
  try {
    await requireAdmin();
    const { gameId } = await context.params;
    const supabase = createServiceClient();
    const { data: game } = await supabase
      .from("games")
      .select("quiz_id,status,current_question_index")
      .eq("id", gameId)
      .single();
    if (!game) {
      return jsonError("게임을 찾을 수 없습니다.", 404);
    }
    if (game.status !== "QUESTION_RESULT" && game.status !== "LEADERBOARD") {
      return jsonError("지금은 다음 문제로 이동할 수 없습니다.", 409);
    }
    const { count } = await supabase
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("quiz_id", game.quiz_id);
    const nextIndex = Number(game.current_question_index) + 1;
    const finished = nextIndex >= (count ?? 0);
    let questionEndsAt: string | null = null;
    if (!finished) {
      const { data: nextQuestion } = await supabase
        .from("questions")
        .select("time_limit")
        .eq("quiz_id", game.quiz_id)
        .eq("order_index", nextIndex)
        .single();
      questionEndsAt = new Date(Date.now() + Number(nextQuestion?.time_limit ?? 15) * 1000).toISOString();
    }
    const { error } = await supabase
      .from("games")
      .update({
        status: finished ? "FINISHED" : "QUESTION",
        current_question_index: finished ? game.current_question_index : nextIndex,
        ended_at: finished ? new Date().toISOString() : null,
        question_started_at: finished ? null : new Date().toISOString(),
        question_ends_at: questionEndsAt,
      })
      .eq("id", gameId);
    if (error) {
      throw error;
    }
    return NextResponse.json({ finished });
  } catch (error) {
    return jsonError(parseError(error), error instanceof Error && error.message === "ADMIN_UNAUTHORIZED" ? 401 : 400);
  }
}
