alter table public.games
  add column if not exists question_ends_at timestamptz;

