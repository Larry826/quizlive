import { NextRequest, NextResponse } from "next/server";
import { maybeCloseQuestion } from "@/lib/game/close-question";
import { jsonError, parseError } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(_request: NextRequest, context: { params: Promise<{ gameId: string }> }) {
  try {
    const { gameId } = await context.params;
    const result = await maybeCloseQuestion(createServiceClient(), gameId, "expired");
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return jsonError(parseError(error));
  }
}

