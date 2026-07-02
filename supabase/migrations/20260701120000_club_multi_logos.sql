-- Club « regroupement » : un même club (un tenant, une licence, un contingent)
-- peut représenter un regroupement de plusieurs clubs et porter plusieurs logos.
-- On ajoute une liste ordonnée d'URLs de logos. `logo_url` reste le logo primaire
-- (rétro-compat) et vaut toujours `logos[1]`.

alter table public.clubs
  add column if not exists logos text[] not null default '{}';

-- Cardinalité raisonnable (max 6 logos par regroupement).
alter table public.clubs
  drop constraint if exists clubs_logos_max;
alter table public.clubs
  add constraint clubs_logos_max
  check (array_length(logos, 1) is null or array_length(logos, 1) <= 6);

-- Backfill : les clubs existants avec un logo unique migrent vers la liste.
update public.clubs
  set logos = array[logo_url]
  where logo_url is not null
    and (logos is null or array_length(logos, 1) is null);
