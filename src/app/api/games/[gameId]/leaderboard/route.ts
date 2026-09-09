import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(_request: NextRequest, context: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await context.params;
  const { data } = await createServiceClient()
    .from("participants")
    .select("id,nickname,score")
    .eq("game_id", gameId)
    .order("score", { ascending: false });
  const leaderboard = (data ?? []).map((entry, index) => ({ ...entry, rank: index + 1 }));
  return NextResponse.json({ leaderboard });
}

