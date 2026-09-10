import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { jsonError, parseError } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest, context: { params: Promise<{ gameId: string }> }) {
  try {
    await requireAdmin();
    const { gameId } = await context.params;
    const questionId = request.nextUrl.searchParams.get("questionId");
    if (!questionId) return jsonError("문제 ID가 필요합니다.", 400);

    const { count, error } = await createServiceClient()
      .from("participant_answers")
      .select("id", { count: "exact", head: true })
      .eq("game_id", gameId)
      .eq("question_id", questionId);
    if (error) throw error;

    return NextResponse.json({ questionId, submittedCount: count ?? 0 });
  } catch (error) {
    return jsonError(parseError(error), error instanceof Error && error.message === "ADMIN_UNAUTHORIZED" ? 401 : 400);
  }
}
