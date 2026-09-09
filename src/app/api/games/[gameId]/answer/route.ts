import { NextRequest, NextResponse } from "next/server";
import { maybeCloseQuestion } from "@/lib/game/close-question";
import { jsonError, parseError } from "@/lib/http";
import { calculateScore } from "@/lib/scoring/scoring";
import { createServiceClient } from "@/lib/supabase/server";
import { answerSubmitSchema } from "@/lib/validation/quiz";

export async function POST(request: NextRequest, context: { params: Promise<{ gameId: string }> }) {
  try {
    const input = answerSubmitSchema.parse(await request.json());
    const { gameId } = await context.params;
    const supabase = createServiceClient();
    const { data: game } = await supabase
      .from("games")
      .select("quiz_id,status,current_question_index,question_started_at,question_ends_at")
      .eq("id", gameId)
      .single();

    if (!game || game.status !== "QUESTION" || !game.question_started_at) {
      return jsonError("지금은 답안을 제출할 수 없습니다.", 409);
    }

    const now = Date.now();
    const endsAt = game.question_ends_at
      ? new Date(game.question_ends_at as string).getTime()
      : new Date(game.question_started_at as string).getTime();
    if (Number.isFinite(endsAt) && endsAt <= now) {
      await maybeCloseQuestion(supabase, gameId, "expired");
      return jsonError("제한 시간이 지났습니다.", 409);
    }

    const { data: participant } = await supabase
      .from("participants")
      .select("id")
      .eq("id", input.participantId)
      .eq("game_id", gameId)
      .single();
    if (!participant) {
      return jsonError("참가자 정보를 찾을 수 없습니다.", 404);
    }

    const { data: question } = await supabase
      .from("questions")
      .select("id,time_limit,points_enabled")
      .eq("quiz_id", game.quiz_id)
      .eq("order_index", game.current_question_index)
      .single();
    if (!question) {
      return jsonError("문제를 찾을 수 없습니다.", 404);
    }

    const { data: answer } = await supabase
      .from("answers")
      .select("id,is_correct")
      .eq("id", input.answerId)
      .eq("question_id", question.id)
      .single();
    if (!answer) {
      return jsonError("선택지를 찾을 수 없습니다.", 404);
    }

    const responseTimeMs = now - new Date(game.question_started_at as string).getTime();
    const scoreAwarded = calculateScore({
      isCorrect: Boolean(answer.is_correct),
      responseTimeMs,
      timeLimitSeconds: Number(question.time_limit),
      pointsEnabled: Boolean(question.points_enabled),
    });

    const { error: insertError } = await supabase.from("participant_answers").insert({
      game_id: gameId,
      question_id: question.id,
      participant_id: input.participantId,
      answer_id: input.answerId,
      response_time_ms: responseTimeMs,
      is_correct: Boolean(answer.is_correct),
      score_awarded: scoreAwarded,
    });
    if (insertError) {
      return jsonError("이미 답안을 제출했습니다.", 409);
    }

    const { error: scoreError } = await supabase.rpc("increment_participant_score", {
      target_participant_id: input.participantId,
      target_game_id: gameId,
      score_delta: scoreAwarded,
    });
    if (scoreError) {
      throw scoreError;
    }

    return NextResponse.json({ submitted: true });
  } catch (error) {
    return jsonError(parseError(error));
  }
}
