import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { jsonError, parseError } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(_request: NextRequest, context: { params: Promise<{ gameId: string }> }) {
  try {
    await requireAdmin();
    const { gameId } = await context.params;
    const supabase = createServiceClient();

    const { data: game } = await supabase
      .from("games")
      .select("quiz_id,status,current_question_index,question_started_at,question_starts_at,question_ends_at")
      .eq("id", gameId)
      .single();
    if (!game) {
      return jsonError("게임을 찾을 수 없습니다.", 404);
    }

    const { data: question } = await supabase
      .from("questions")
      .select("id,order_index,question_text,time_limit,answers(id,answer_text,answer_index)")
      .eq("quiz_id", game.quiz_id)
      .eq("order_index", game.current_question_index)
      .single();
    if (!question) {
      return jsonError("현재 문제를 찾을 수 없습니다.", 404);
    }

    return NextResponse.json({
      status: game.status,
      questionStartedAt: game.question_started_at,
      questionStartsAt: game.question_starts_at,
      questionEndsAt: game.question_ends_at,
      serverNow: new Date().toISOString(),
      question,
    });
  } catch (error) {
    return jsonError(parseError(error), error instanceof Error && error.message === "ADMIN_UNAUTHORIZED" ? 401 : 400);
  }
}
