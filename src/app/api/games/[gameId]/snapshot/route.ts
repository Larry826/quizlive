import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(_request: NextRequest, context: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await context.params;
  const supabase = createServiceClient();
  const { data: game, error } = await supabase
    .from("games")
    .select("id,pin,status,current_question_index,question_started_at,question_starts_at,question_ends_at,quizzes(title,questions(id))")
    .eq("id", gameId)
    .single();
  if (error || !game) {
    return jsonError(error?.message || "게임을 찾을 수 없습니다.", 404);
  }
  return NextResponse.json({ game, serverNow: new Date().toISOString() });
}
