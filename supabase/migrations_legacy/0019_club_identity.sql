-- Club visual identity used to theme the app shell and club-facing surfaces.

alter table public.clubs
  add column if not exists logo_url text,
  add column if not exists theme_mode text not null default 'day'
    check (theme_mode in ('day', 'night')),
  add column if not exists theme_primary_color text not null default '#18181b',
  add column if not exists theme_secondary_color text not null default '#f4f4f5',
  add column if not exists theme_night_primary_color text not null default '#f4f4f5',
  add column if not exists theme_night_secondary_color text not null default '#18181b';

alter table public.clubs
  add constraint clubs_logo_url_length check (logo_url is null or length(logo_url) <= 500),
  add constraint clubs_theme_primary_color_hex check (theme_primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  add constraint clubs_theme_secondary_color_hex check (theme_secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  add constraint clubs_theme_night_primary_color_hex check (theme_night_primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  add constraint clubs_theme_night_secondary_color_hex check (theme_night_secondary_color ~ '^#[0-9A-Fa-f]{6}$');
