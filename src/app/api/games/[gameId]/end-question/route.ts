import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { maybeCloseQuestion } from "@/lib/game/close-question";
import { jsonError, parseError } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(_request: NextRequest, context: { params: Promise<{ gameId: string }> }) {
  try {
    await requireAdmin();
    const { gameId } = await context.params;
    const result = await maybeCloseQuestion(createServiceClient(), gameId, "manual");
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return jsonError(parseError(error), error instanceof Error && error.message === "ADMIN_UNAUTHORIZED" ? 401 : 400);
  }
}
