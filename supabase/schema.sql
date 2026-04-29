-- Grinta — initial schema
-- Run once in the Supabase SQL editor (or `supabase db push`).

create extension if not exists "pgcrypto";

-- Trainers (1:1 with auth.users)
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  created_at timestamptz default now()
);

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  season text,
  age_group text,
  created_at timestamptz default now()
);

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  trainer_id uuid not null references profiles(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  birth_date date,
  position text,
  jersey_number int,
  notes text,
  created_at timestamptz default now()
);

create table if not exists exercises (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  description text,
  category text,
  duration_minutes int,
  intensity text,
  equipment text[],
  created_at timestamptz default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  trainer_id uuid not null references profiles(id) on delete cascade,
  date date not null,
  start_time time,
  duration_minutes int,
  theme text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists session_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  exercise_id uuid not null references exercises(id) on delete restrict,
  order_index int not null default 0,
  duration_override_minutes int,
  notes text
);

create index if not exists teams_trainer_idx on teams (trainer_id);
create index if not exists players_team_idx on players (team_id);
create index if not exists exercises_trainer_idx on exercises (trainer_id);
create index if not exists sessions_team_date_idx on sessions (team_id, date);
create index if not exists session_exercises_session_idx on session_exercises (session_id);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- RLS
alter table profiles          enable row level security;
alter table teams             enable row level security;
alter table players           enable row level security;
alter table exercises         enable row level security;
alter table sessions          enable row level security;
alter table session_exercises enable row level security;

drop policy if exists "own profile" on profiles;
create policy "own profile" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "own teams" on teams;
create policy "own teams" on teams
  for all using (auth.uid() = trainer_id) with check (auth.uid() = trainer_id);

drop policy if exists "own players" on players;
create policy "own players" on players
  for all using (auth.uid() = trainer_id) with check (auth.uid() = trainer_id);

drop policy if exists "own exercises" on exercises;
create policy "own exercises" on exercises
  for all using (auth.uid() = trainer_id) with check (auth.uid() = trainer_id);

drop policy if exists "own sessions" on sessions;
create policy "own sessions" on sessions
  for all using (auth.uid() = trainer_id) with check (auth.uid() = trainer_id);

drop policy if exists "own session_exercises" on session_exercises;
create policy "own session_exercises" on session_exercises
  for all
  using (exists (select 1 from sessions s where s.id = session_id and s.trainer_id = auth.uid()))
  with check (exists (select 1 from sessions s where s.id = session_id and s.trainer_id = auth.uid()));
