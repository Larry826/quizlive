import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest, context: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await context.params;
  const supabase = createServiceClient();

  const { data: game } = await supabase
    .from("games")
    .select("quiz_id,status,current_question_index,question_started_at,question_ends_at")
    .eq("id", gameId)
    .single();
  if (!game) {
    return jsonError("게임을 찾을 수 없습니다.", 404);
  }

  const { data: question } = await supabase
    .from("questions")
    .select("id,order_index,time_limit,answers(id,answer_index)")
    .eq("quiz_id", game.quiz_id)
    .eq("order_index", game.current_question_index)
    .single();
  if (!question) {
    return jsonError("현재 문제를 찾을 수 없습니다.", 404);
  }

  const participantId = request.nextUrl.searchParams.get("participantId");
  const { data: submittedAnswer } = participantId
    ? await supabase
        .from("participant_answers")
        .select("answer_id")
        .eq("game_id", gameId)
        .eq("question_id", question.id)
        .eq("participant_id", participantId)
        .maybeSingle()
    : { data: null };

  return NextResponse.json({
    status: game.status,
    questionStartedAt: game.question_started_at,
    questionEndsAt: game.question_ends_at,
    submittedAnswerId: submittedAnswer?.answer_id ?? null,
    question: {
      id: question.id,
      order_index: question.order_index,
      time_limit: question.time_limit,
      answers: question.answers,
    },
  });
}
