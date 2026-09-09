import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseError } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/server";
import { joinGameSchema } from "@/lib/validation/quiz";

export async function POST(request: NextRequest) {
  try {
    const input = joinGameSchema.parse(await request.json());
    const supabase = createServiceClient();
    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("id,status")
      .eq("pin", input.pin)
      .maybeSingle();
    if (gameError) {
      throw gameError;
    }
    if (!game) {
      return jsonError("유효한 게임 PIN이 아닙니다.", 404);
    }
    if (game.status !== "LOBBY") {
      return jsonError("이미 시작되었거나 종료된 게임입니다.", 409);
    }

    const { data: existing, error: existingError } = await supabase
      .from("participants")
      .select("id")
      .eq("game_id", game.id)
      .eq("nickname", input.nickname)
      .maybeSingle();
    if (existingError) {
      throw existingError;
    }
    if (existing) {
      return jsonError("이미 사용 중인 닉네임입니다.", 409);
    }

    const { data: participant, error } = await supabase
      .from("participants")
      .insert({ game_id: game.id, nickname: input.nickname, score: 0 })
      .select("id,game_id,nickname,score")
      .single();
    if (error || !participant) {
      throw error || new Error("입장하지 못했습니다.");
    }

    return NextResponse.json({ participant, gameId: game.id }, { status: 201 });
  } catch (error) {
    return jsonError(parseError(error));
  }
}

