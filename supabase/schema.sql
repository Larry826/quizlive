create extension if not exists pgcrypto;

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) > 0),
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  order_index integer not null check (order_index >= 0),
  question_text text not null check (char_length(trim(question_text)) > 0),
  time_limit integer not null default 15 check (time_limit in (5,10,15,20,30,45,60)),
  points_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (quiz_id, order_index)
);

create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  answer_text text not null check (char_length(trim(answer_text)) > 0),
  answer_index integer not null check (answer_index between 0 and 3),
  is_correct boolean not null default false,
  unique (question_id, answer_index)
);

create unique index if not exists one_correct_answer_per_question
  on public.answers(question_id)
  where is_correct;

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  pin text not null check (pin ~ '^[0-9]{6}$'),
  status text not null default 'LOBBY' check (status in ('LOBBY','QUESTION','QUESTION_RESULT','LEADERBOARD','FINISHED')),
  current_question_index integer not null default 0 check (current_question_index >= 0),
  question_started_at timestamptz,
  question_starts_at timestamptz,
  question_ends_at timestamptz,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz
);

create unique index if not exists active_game_pin_unique
  on public.games(pin)
  where status <> 'FINISHED';

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  nickname text not null check (char_length(trim(nickname)) between 1 and 20),
  score integer not null default 0 check (score >= 0),
  joined_at timestamptz not null default now(),
  unique (game_id, nickname)
);

create table if not exists public.participant_answers (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  answer_id uuid not null references public.answers(id) on delete cascade,
  submitted_at timestamptz not null default now(),
  response_time_ms integer not null check (response_time_ms >= 0),
  is_correct boolean not null,
  score_awarded integer not null default 0 check (score_awarded >= 0),
  unique (game_id, question_id, participant_id)
);

create index if not exists questions_quiz_order_idx on public.questions(quiz_id, order_index);
create index if not exists answers_question_idx on public.answers(question_id);
create index if not exists participants_game_score_idx on public.participants(game_id, score desc);
create index if not exists participant_answers_game_question_idx on public.participant_answers(game_id, question_id);
create index if not exists participant_answers_participant_question_idx on public.participant_answers(participant_id, question_id);

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
  select * into v_game from public.games where id = p_game_id for share;
  if not found then raise exception '게임을 찾을 수 없습니다.'; end if;
  if v_game.status <> 'QUESTION' or v_game.question_started_at is null then
    raise exception '지금은 답안을 제출할 수 없습니다.';
  end if;

  v_starts_at := coalesce(v_game.question_starts_at, v_game.question_started_at);
  v_ends_at := coalesce(v_game.question_ends_at, v_starts_at);
  if v_received_at < v_starts_at then raise exception '문제가 아직 시작되지 않았습니다.'; end if;
  if v_received_at >= v_ends_at + interval '1500 milliseconds' then raise exception '제한 시간이 지났습니다.'; end if;

  perform 1 from public.participants where id = p_participant_id and game_id = p_game_id;
  if not found then raise exception '참가자 정보를 찾을 수 없습니다.'; end if;

  select q.id, q.time_limit, q.points_enabled, a.is_correct
    into v_question_id, v_time_limit, v_points_enabled, v_is_correct
  from public.questions q
  join public.answers a on a.question_id = q.id and a.id = p_answer_id
  where q.quiz_id = v_game.quiz_id and q.order_index = v_game.current_question_index;
  if not found then raise exception '선택지를 찾을 수 없습니다.'; end if;

  v_response_time_ms := greatest(0, round(extract(epoch from (least(v_received_at, v_ends_at) - v_starts_at)) * 1000)::integer);
  if v_is_correct and v_points_enabled then
    v_limit_ms := greatest(v_time_limit, 1) * 1000;
    v_score_awarded := greatest(100, round(500 + (1 - least(v_response_time_ms, v_limit_ms)::numeric / v_limit_ms) * 500)::integer);
  end if;

  begin
    insert into public.participant_answers (
      game_id, question_id, participant_id, answer_id, response_time_ms, is_correct, score_awarded
    ) values (
      p_game_id, v_question_id, p_participant_id, p_answer_id, v_response_time_ms, v_is_correct, v_score_awarded
    );
  exception when unique_violation then
    raise exception '이미 답안을 제출했습니다.';
  end;

  update public.participants
  set score = score + v_score_awarded
  where id = p_participant_id and game_id = p_game_id;

  return query select p_answer_id;
end;
$$;

revoke all on function public.submit_quiz_answer(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.submit_quiz_answer(uuid, uuid, uuid) to service_role;

alter table public.quizzes enable row level security;
alter table public.questions enable row level security;
alter table public.answers enable row level security;
alter table public.games enable row level security;
alter table public.participants enable row level security;
alter table public.participant_answers enable row level security;

create policy "anon can read live games" on public.games for select using (true);
create policy "anon can read quiz questions" on public.questions for select using (true);
create policy "anon can read public answers" on public.answers for select using (true);
create policy "anon can read participants" on public.participants for select using (true);
create policy "anon can read submitted counts" on public.participant_answers for select using (true);

alter publication supabase_realtime add table public.games;
alter publication supabase_realtime add table public.participants;
alter publication supabase_realtime add table public.participant_answers;

insert into public.quizzes (id, title, description)
values ('00000000-0000-4000-8000-000000000001', '상식 퀴즈', '개발 테스트용 기본 퀴즈입니다.')
on conflict (id) do nothing;

insert into public.questions (id, quiz_id, order_index, question_text, time_limit, points_enabled)
values
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001', 0, '대한민국의 수도는 어디일까요?', 20, true),
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000001', 1, '물의 화학식은 무엇일까요?', 20, true),
  ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000001', 2, '지구에서 가장 큰 대양은?', 20, true),
  ('00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000001', 3, '빛의 속도에 가장 가까운 값은?', 20, true),
  ('00000000-0000-4000-8000-000000000105', '00000000-0000-4000-8000-000000000001', 4, 'HTML은 주로 무엇을 만들 때 쓰일까요?', 20, true)
on conflict (id) do nothing;

insert into public.answers (question_id, answer_text, answer_index, is_correct)
values
  ('00000000-0000-4000-8000-000000000101','서울',0,true), ('00000000-0000-4000-8000-000000000101','부산',1,false), ('00000000-0000-4000-8000-000000000101','인천',2,false), ('00000000-0000-4000-8000-000000000101','대전',3,false),
  ('00000000-0000-4000-8000-000000000102','H2O',0,true), ('00000000-0000-4000-8000-000000000102','CO2',1,false), ('00000000-0000-4000-8000-000000000102','O2',2,false), ('00000000-0000-4000-8000-000000000102','NaCl',3,false),
  ('00000000-0000-4000-8000-000000000103','태평양',0,true), ('00000000-0000-4000-8000-000000000103','대서양',1,false), ('00000000-0000-4000-8000-000000000103','인도양',2,false), ('00000000-0000-4000-8000-000000000103','북극해',3,false),
  ('00000000-0000-4000-8000-000000000104','초속 약 30만 km',0,true), ('00000000-0000-4000-8000-000000000104','초속 약 300 km',1,false), ('00000000-0000-4000-8000-000000000104','초속 약 3 km',2,false), ('00000000-0000-4000-8000-000000000104','초속 약 30 km',3,false),
  ('00000000-0000-4000-8000-000000000105','웹 문서 구조',0,true), ('00000000-0000-4000-8000-000000000105','데이터베이스 백업',1,false), ('00000000-0000-4000-8000-000000000105','동영상 압축',2,false), ('00000000-0000-4000-8000-000000000105','운영체제 설치',3,false)
on conflict do nothing;
