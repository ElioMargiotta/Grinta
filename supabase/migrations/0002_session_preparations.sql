-- Adds the training preparation sheet (1:1 with sessions).
-- Run once in the Supabase SQL editor.

create table if not exists session_preparations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references sessions(id) on delete cascade,
  trainer_id uuid not null references profiles(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists session_preparations_session_idx
  on session_preparations (session_id);

alter table session_preparations enable row level security;

drop policy if exists "own session_preparations" on session_preparations;
create policy "own session_preparations" on session_preparations
  for all
  using (auth.uid() = trainer_id)
  with check (auth.uid() = trainer_id);
