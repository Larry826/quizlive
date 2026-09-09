import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { createServiceClient, hasSupabaseConfig } from "@/lib/supabase/server";

export async function GET(_request: NextRequest, context: { params: Promise<{ pin: string }> }) {
  if (!hasSupabaseConfig()) {
    return jsonError("Supabase가 설정되지 않았습니다.", 503);
  }
  const { pin } = await context.params;
  const { data, error } = await createServiceClient()
    .from("games")
    .select("id,pin,status,quizzes(title)")
    .eq("pin", pin)
    .not("status", "eq", "FINISHED")
    .maybeSingle();

  if (error) {
    return jsonError(error.message);
  }
  if (!data) {
    return jsonError("유효한 게임 PIN이 아닙니다.", 404);
  }

  return NextResponse.json({ game: data });
}

