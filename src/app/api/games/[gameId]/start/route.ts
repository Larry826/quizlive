import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { jsonError, parseError } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(_request: NextRequest, context: { params: Promise<{ gameId: string }> }) {
  try {
    await requireAdmin();
    const { gameId } = await context.params;
    const supabase = createServiceClient();
    const { count } = await supabase
      .from("participants")
      .select("id", { count: "exact", head: true })
      .eq("game_id", gameId);
    if (!count) {
      return jsonError("참가자가 있어야 시작할 수 있습니다.", 409);
    }
    const { data: game } = await supabase.from("games").select("quiz_id").eq("id", gameId).single();
    const { data: firstQuestion } = await supabase
      .from("questions")
      .select("time_limit")
      .eq("quiz_id", game?.quiz_id)
      .eq("order_index", 0)
      .single();
    const startedAt = new Date();
    const { error } = await supabase
      .from("games")
      .update({
        status: "QUESTION",
        current_question_index: 0,
        started_at: startedAt.toISOString(),
        question_started_at: startedAt.toISOString(),
        question_ends_at: new Date(startedAt.getTime() + Number(firstQuestion?.time_limit ?? 15) * 1000).toISOString(),
      })
      .eq("id", gameId)
      .eq("status", "LOBBY");
    if (error) {
      throw error;
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(parseError(error), error instanceof Error && error.message === "ADMIN_UNAUTHORIZED" ? 401 : 400);
  }
}
