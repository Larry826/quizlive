import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseError } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/server";
import { answerSubmitSchema } from "@/lib/validation/quiz";

export async function POST(request: NextRequest, context: { params: Promise<{ gameId: string }> }) {
  try {
    const input = answerSubmitSchema.parse(await request.json());
    const { gameId } = await context.params;
    const { data, error } = await createServiceClient().rpc("submit_quiz_answer", {
      p_game_id: gameId,
      p_participant_id: input.participantId,
      p_answer_id: input.answerId,
    });
    if (error) {
      const status = error.message.includes("찾을 수 없습니다") ? 404 : 409;
      return jsonError(error.message || "답안을 제출하지 못했습니다.", status);
    }

    return NextResponse.json({
      ok: true,
      submittedAnswerId: data?.[0]?.submitted_answer_id ?? input.answerId,
    });
  } catch (error) {
    return jsonError(parseError(error));
  }
}
