import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { jsonError, parseError } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/server";

type AnswerRow = {
  id: string;
  answer_text: string;
  answer_index: number;
  is_correct: boolean;
};

type QuestionTopRow = {
  id: string;
  score_awarded: number;
  response_time_ms: number;
  submitted_at: string;
  participants: { nickname: string }[] | { nickname: string } | null;
};

export async function GET(_request: NextRequest, context: { params: Promise<{ gameId: string }> }) {
  try {
    await requireAdmin();
    const { gameId } = await context.params;
    const supabase = createServiceClient();

    const { data: game } = await supabase
      .from("games")
      .select("id,quiz_id,status,current_question_index,question_started_at,question_starts_at,question_ends_at,quizzes(questions(id))")
      .eq("id", gameId)
      .single();
    if (!game) {
      return jsonError("게임을 찾을 수 없습니다.", 404);
    }

    const { data: question } = await supabase
      .from("questions")
      .select("id,order_index,question_text,time_limit,answers(id,answer_text,answer_index,is_correct)")
      .eq("quiz_id", game.quiz_id)
      .eq("order_index", game.current_question_index)
      .single();
    if (!question) {
      return jsonError("문제를 찾을 수 없습니다.", 404);
    }

    const answers = ([...(question.answers as AnswerRow[])]).sort(
      (first, second) => first.answer_index - second.answer_index,
    );
    const [answerCountsResult, questionTopResult, cumulativeResult, participantCountResult] = await Promise.all([
      supabase
        .from("participant_answers")
        .select("answer_id")
        .eq("game_id", gameId)
        .eq("question_id", question.id),
      supabase
        .from("participant_answers")
        .select("id,score_awarded,response_time_ms,submitted_at,participants(nickname)")
        .eq("game_id", gameId)
        .eq("question_id", question.id)
        .eq("is_correct", true)
        .order("score_awarded", { ascending: false })
        .order("response_time_ms", { ascending: true })
        .order("submitted_at", { ascending: true })
        .limit(5),
      supabase
        .from("participants")
        .select("id,nickname,score")
        .eq("game_id", gameId)
        .order("score", { ascending: false })
        .order("joined_at", { ascending: true })
        .limit(5),
      supabase.from("participants").select("id", { count: "exact", head: true }).eq("game_id", gameId),
    ]);
    const answerCounts = answerCountsResult.data;
    const questionTopRows = questionTopResult.data;
    const cumulativeRows = cumulativeResult.data;
    const participantCount = participantCountResult.count;
    const countMap = new Map<string, number>();
    for (const row of answerCounts ?? []) {
      const answerId = row.answer_id as string;
      countMap.set(answerId, (countMap.get(answerId) ?? 0) + 1);
    }
    const questions = Array.isArray(game.quizzes)
      ? game.quizzes[0]?.questions
      : (game.quizzes as { questions?: { id: string }[] } | null)?.questions;
    const totalQuestions = questions?.length ?? 0;

    return NextResponse.json({
      status: game.status,
      question: {
        id: question.id,
        orderIndex: question.order_index,
        text: question.question_text,
        timeLimit: question.time_limit,
      },
      answers: answers.map((answer) => ({
        id: answer.id,
        answerIndex: answer.answer_index,
        text: answer.answer_text,
        isCorrect: answer.is_correct,
        count: countMap.get(answer.id) ?? 0,
      })),
      submittedCount: answerCounts?.length ?? 0,
      participantCount: participantCount ?? 0,
      totalQuestions,
      isLastQuestion: Number(game.current_question_index) >= totalQuestions - 1,
      questionTop5: ((questionTopRows ?? []) as QuestionTopRow[]).map((row, index) => {
        const participant = Array.isArray(row.participants) ? row.participants[0] : row.participants;
        return {
          rank: index + 1,
          nickname: participant?.nickname ?? "참가자",
          scoreAwarded: row.score_awarded,
          responseTimeMs: row.response_time_ms,
        };
      }),
      cumulativeTop5: (cumulativeRows ?? []).map((row, index) => ({
        rank: index + 1,
        nickname: row.nickname,
        score: row.score,
      })),
    });
  } catch (error) {
    return jsonError(parseError(error), error instanceof Error && error.message === "ADMIN_UNAUTHORIZED" ? 401 : 400);
  }
}
