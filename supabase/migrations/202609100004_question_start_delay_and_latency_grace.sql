alter table public.games
  add column if not exists question_starts_at timestamptz;
