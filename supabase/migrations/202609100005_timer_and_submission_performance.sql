create or replace function public.submit_quiz_answer(
  p_game_id uuid,
  p_participant_id uuid,
  p_answer_id uuid
)
returns table(submitted_answer_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.games%rowtype;
  v_question_id uuid;
  v_time_limit integer;
  v_points_enabled boolean;
  v_is_correct boolean;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_received_at timestamptz := clock_timestamp();
  v_response_time_ms integer;
  v_limit_ms integer;
  v_score_awarded integer := 0;
begin
  select * into v_game
  from public.games
  where id = p_game_id
  for share;

  if not found then
    raise exception '게임을 찾을 수 없습니다.';
  end if;
  if v_game.status <> 'QUESTION' or v_game.question_started_at is null then
    raise exception '지금은 답안을 제출할 수 없습니다.';
  end if;

  v_starts_at := coalesce(v_game.question_starts_at, v_game.question_started_at);
  v_ends_at := coalesce(v_game.question_ends_at, v_starts_at);
  if v_received_at < v_starts_at then
    raise exception '문제가 아직 시작되지 않았습니다.';
  end if;
  if v_received_at >= v_ends_at + interval '1500 milliseconds' then
    raise exception '제한 시간이 지났습니다.';
  end if;

  perform 1
  from public.participants
  where id = p_participant_id
    and game_id = p_game_id;
  if not found then
    raise exception '참가자 정보를 찾을 수 없습니다.';
  end if;

  select q.id, q.time_limit, q.points_enabled, a.is_correct
    into v_question_id, v_time_limit, v_points_enabled, v_is_correct
  from public.questions q
  join public.answers a
    on a.question_id = q.id
   and a.id = p_answer_id
  where q.quiz_id = v_game.quiz_id
    and q.order_index = v_game.current_question_index;
  if not found then
    raise exception '선택지를 찾을 수 없습니다.';
  end if;

  v_response_time_ms := greatest(
    0,
    round(extract(epoch from (least(v_received_at, v_ends_at) - v_starts_at)) * 1000)::integer
  );

  if v_is_correct and v_points_enabled then
    v_limit_ms := greatest(v_time_limit, 1) * 1000;
    v_score_awarded := greatest(
      100,
      round(500 + (1 - least(v_response_time_ms, v_limit_ms)::numeric / v_limit_ms) * 500)::integer
    );
  end if;

  begin
    insert into public.participant_answers (
      game_id,
      question_id,
      participant_id,
      answer_id,
      response_time_ms,
      is_correct,
      score_awarded
    ) values (
      p_game_id,
      v_question_id,
      p_participant_id,
      p_answer_id,
      v_response_time_ms,
      v_is_correct,
      v_score_awarded
    );
  exception when unique_violation then
    raise exception '이미 답안을 제출했습니다.';
  end;

  update public.participants
  set score = score + v_score_awarded
  where id = p_participant_id
    and game_id = p_game_id;

  return query select p_answer_id;
end;
$$;

revoke all on function public.submit_quiz_answer(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.submit_quiz_answer(uuid, uuid, uuid) to service_role;
