import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest, context: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await context.params;
  const supabase = createServiceClient();

  const { data: game } = await supabase
    .from("games")
    .select("quiz_id,status,current_question_index,question_started_at,question_starts_at,question_ends_at,quizzes(questions(id))")
    .eq("id", gameId)
    .single();
  if (!game) {
    return jsonError("게임을 찾을 수 없습니다.", 404);
  }

  const questions = Array.isArray(game.quizzes)
    ? game.quizzes[0]?.questions
    : (game.quizzes as { questions?: { id: string }[] } | null)?.questions;
  const totalQuestions = questions?.length ?? 0;
  let question: {
    id: string;
    order_index: number;
    time_limit: number;
    answers: { id: string; answer_index: number }[];
  } | null = null;
  let submittedAnswerId: string | null = null;

  const participantId = request.nextUrl.searchParams.get("participantId");
  if (game.status === "QUESTION") {
    const { data } = await supabase
      .from("questions")
      .select("id,order_index,time_limit,answers(id,answer_index)")
      .eq("quiz_id", game.quiz_id)
      .eq("order_index", game.current_question_index)
      .single();
    question = data;
    if (!question) {
      return jsonError("현재 문제를 찾을 수 없습니다.", 404);
    }

    const { data: submittedAnswer } = participantId
      ? await supabase
        .from("participant_answers")
        .select("answer_id")
        .eq("game_id", gameId)
        .eq("question_id", question.id)
        .eq("participant_id", participantId)
        .maybeSingle()
      : { data: null };
    submittedAnswerId = submittedAnswer?.answer_id ?? null;
  }

  return NextResponse.json({
    status: game.status,
    questionIndex: game.current_question_index,
    totalQuestions,
    questionStartedAt: game.question_started_at,
    questionStartsAt: game.question_starts_at,
    questionEndsAt: game.question_ends_at,
    serverNow: new Date().toISOString(),
    submittedAnswerId,
    question,
  });
}
