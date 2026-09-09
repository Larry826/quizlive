import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(_request: NextRequest, context: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await context.params;
  const { data } = await createServiceClient()
    .from("participants")
    .select("id,nickname,score,joined_at")
    .eq("game_id", gameId)
    .order("joined_at");
  return NextResponse.json({ participants: data ?? [] });
}

