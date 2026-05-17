-- Grinta — periodization model (Footeco-style: macrocycle / mésocycle / microcycle)
--
-- Adds three new tables (macrocycles, mesocycles, microcycles) and a nullable
-- microcycle_id FK on sessions so each session can be anchored to a microcycle.
--
-- All rows are scoped per trainer via RLS (same pattern as existing tables).

-- Macrocycle = a "tour" of a season (e.g. "1er tour", "2e tour")
create table if not exists macrocycles (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  trainer_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  order_index int not null default 0,
  preseason_start_date date not null,
  first_match_date date not null,
  end_date date not null,
  notes text,
  created_at timestamptz default now(),
  constraint macrocycles_dates_check check (
    preseason_start_date <= first_match_date
    and first_match_date <= end_date
  )
);

-- Mésocycle = a phase inside a macrocycle (Préparation / Compétition / Transition / custom)
create table if not exists mesocycles (
  id uuid primary key default gen_random_uuid(),
  macrocycle_id uuid not null references macrocycles(id) on delete cascade,
  trainer_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  kind text not null default 'custom',
  order_index int not null default 0,
  color text,
  created_at timestamptz default now(),
  constraint mesocycles_kind_check check (
    kind in ('preparation', 'competition', 'transition', 'custom')
  )
);

-- Microcycle = one training week
create table if not exists microcycles (
  id uuid primary key default gen_random_uuid(),
  mesocycle_id uuid not null references mesocycles(id) on delete cascade,
  trainer_id uuid not null references profiles(id) on delete cascade,
  start_date date not null,
  week_number int not null,
  theme text,
  format text,
  notes text,
  created_at timestamptz default now(),
  constraint microcycles_unique_start unique (mesocycle_id, start_date)
);

-- Sessions belong to a microcycle once periodization is set up.
-- Nullable so legacy sessions keep working; on delete we keep the session
-- but detach it (the user can re-anchor later).
alter table sessions
  add column if not exists microcycle_id uuid references microcycles(id) on delete set null;

create index if not exists macrocycles_team_idx on macrocycles (team_id, order_index);
create index if not exists mesocycles_macrocycle_idx on mesocycles (macrocycle_id, order_index);
create index if not exists microcycles_mesocycle_idx on microcycles (mesocycle_id, start_date);
create index if not exists sessions_microcycle_idx on sessions (microcycle_id);

alter table macrocycles enable row level security;
alter table mesocycles  enable row level security;
alter table microcycles enable row level security;

drop policy if exists "own macrocycles" on macrocycles;
create policy "own macrocycles" on macrocycles
  for all using (auth.uid() = trainer_id) with check (auth.uid() = trainer_id);

drop policy if exists "own mesocycles" on mesocycles;
create policy "own mesocycles" on mesocycles
  for all using (auth.uid() = trainer_id) with check (auth.uid() = trainer_id);

drop policy if exists "own microcycles" on microcycles;
create policy "own microcycles" on microcycles
  for all using (auth.uid() = trainer_id) with check (auth.uid() = trainer_id);
