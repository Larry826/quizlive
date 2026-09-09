import type { SupabaseClient } from "@supabase/supabase-js";

type CloseReason = "manual" | "expired";

type CloseResult = {
  closed: boolean;
  status: string;
  reason: CloseReason | "already_closed" | "not_ready";
};

export async function getCurrentQuestion(
  supabase: SupabaseClient,
  game: { quiz_id: string; current_question_index: number },
) {
  const { data, error } = await supabase
    .from("questions")
    .select("id,order_index,question_text,time_limit,points_enabled,answers(id,answer_text,answer_index,is_correct)")
    .eq("quiz_id", game.quiz_id)
    .eq("order_index", game.current_question_index)
    .single();

  if (error) {
    throw error;
  }
  return data;
}

export async function maybeCloseQuestion(
  supabase: SupabaseClient,
  gameId: string,
  reason: CloseReason,
): Promise<CloseResult> {
  const { data: game, error: gameError } = await supabase
    .from("games")
    .select("id,status,question_ends_at")
    .eq("id", gameId)
    .single();

  if (gameError || !game) {
    throw gameError || new Error("게임을 찾을 수 없습니다.");
  }

  if (game.status !== "QUESTION") {
    return { closed: false, status: game.status as string, reason: "already_closed" };
  }

  const canClose =
    reason === "manual" ||
    Boolean(game.question_ends_at && new Date(game.question_ends_at as string).getTime() <= Date.now());

  if (!canClose) {
    return { closed: false, status: "QUESTION", reason: "not_ready" };
  }

  const { data: updated, error: updateError } = await supabase
    .from("games")
    .update({ status: "QUESTION_RESULT" })
    .eq("id", gameId)
    .eq("status", "QUESTION")
    .select("status")
    .maybeSingle();

  if (updateError) {
    throw updateError;
  }

  return {
    closed: Boolean(updated),
    status: "QUESTION_RESULT",
    reason,
  };
}

