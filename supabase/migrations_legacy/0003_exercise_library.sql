-- Extends `exercises` with the rich fields needed to import the
-- ASF / clubcorner training library and to power the library
-- filter UI (theme / niveau / coaching family).
--
-- Library rows have `trainer_id IS NULL` and `source = 'clubcorner_2026'`,
-- and are readable by every authenticated trainer (read policy below).
-- Per-trainer exercises continue to behave the same way as before.
--
-- Columns are named in French to match the PDF source vocabulary —
-- coaches will see this naming again in the filter chips and in the
-- prep-sheet "import from library" picker.

alter table exercises
  alter column trainer_id drop not null;

alter table exercises
  add column if not exists code             text,
  add column if not exists titre            text,
  add column if not exists theme            text,
  add column if not exists track            text,
  add column if not exists level            int,
  add column if not exists niveau           text,
  add column if not exists duree            text,
  add column if not exists organisation     text,
  add column if not exists forme_physique   text[] not null default array[]::text[],
  add column if not exists tactique         text[] not null default array[]::text[],
  add column if not exists mentalite        text[] not null default array[]::text[],
  add column if not exists technique        text[] not null default array[]::text[],
  add column if not exists main_image           text,
  add column if not exists variation_less_text  text,
  add column if not exists variation_more_text  text,
  add column if not exists source           text;

-- `code` is the natural key from the PDF (e.g. OFF_Basis_01).
-- Partial unique index lets per-trainer rows keep `code IS NULL`.
create unique index if not exists exercises_code_uniq
  on exercises (code) where code is not null;

-- Filter dimensions used by the /exercises page: theme (4 phases),
-- track (Base TA / Dev TA / Stratégie Team), level (1–6), source.
create index if not exists exercises_theme_idx  on exercises (theme);
create index if not exists exercises_track_idx  on exercises (track);
create index if not exists exercises_level_idx  on exercises (level);
create index if not exists exercises_source_idx on exercises (source);

-- GIN indexes for filtering by coaching-point family (TE/TA/PE/AT).
create index if not exists exercises_forme_physique_idx on exercises using gin (forme_physique);
create index if not exists exercises_tactique_idx       on exercises using gin (tactique);
create index if not exists exercises_mentalite_idx      on exercises using gin (mentalite);
create index if not exists exercises_technique_idx      on exercises using gin (technique);

-- Replace the single owner-only RLS policy with a read policy
-- (own + library) and a write policy (own only).
drop policy if exists "own exercises"   on exercises;
drop policy if exists "read exercises"  on exercises;
drop policy if exists "write exercises" on exercises;

create policy "read exercises" on exercises
  for select
  using (trainer_id is null or auth.uid() = trainer_id);

create policy "write exercises" on exercises
  for all
  using (auth.uid() = trainer_id)
  with check (auth.uid() = trainer_id);
