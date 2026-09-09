create index if not exists participant_answers_participant_question_idx
  on public.participant_answers(participant_id, question_id);

create or replace function public.increment_participant_score(
  target_participant_id uuid,
  target_game_id uuid,
  score_delta integer
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.participants
  set score = score + greatest(score_delta, 0)
  where id = target_participant_id
    and game_id = target_game_id;
$$;
