import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { generatePin } from "@/lib/game/pin";
import { jsonError, parseError } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = (await request.json()) as { quizId?: string };
    if (!body.quizId) {
      return jsonError("퀴즈를 선택하세요.");
    }

    const supabase = createServiceClient();
    let pin = generatePin();
    for (let attempts = 0; attempts < 8; attempts += 1) {
      const { data } = await supabase
        .from("games")
        .select("id")
        .eq("pin", pin)
        .not("status", "eq", "FINISHED")
        .maybeSingle();
      if (!data) {
        break;
      }
      pin = generatePin();
    }

    const { data: game, error } = await supabase
      .from("games")
      .insert({
        quiz_id: body.quizId,
        pin,
        status: "LOBBY",
        current_question_index: 0,
      })
      .select("id,pin")
      .single();
    if (error || !game) {
      throw error || new Error("게임을 만들지 못했습니다.");
    }

    return NextResponse.json(game, { status: 201 });
  } catch (error) {
    return jsonError(parseError(error), error instanceof Error && error.message === "ADMIN_UNAUTHORIZED" ? 401 : 400);
  }
}

