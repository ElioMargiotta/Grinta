-- Lot 2 (kit de match) — champs de résultat sur `team_matches`.
--
-- Un match passé est archivé (archived = true) pour le protéger de la
-- resynchronisation ICS (le flux ne republie plus les matchs joués). Il reste
-- pourtant utile dans le planning : on veut y saisir le SCORE, des notes, et
-- plus tard les participations (Lot 2). On ajoute donc les champs résultat dès
-- maintenant pour pouvoir afficher le score sur la frise.
--
-- Score stocké de façon OBJECTIVE (domicile / extérieur) ; le sens « victoire /
-- nul / défaite » se dérive de `home_away` côté affichage.
--
-- Additif, schéma public uniquement. RLS héritée de la table (déjà scopée club).

BEGIN;

ALTER TABLE public.team_matches
  ADD COLUMN IF NOT EXISTS home_score   integer,
  ADD COLUMN IF NOT EXISTS away_score   integer,
  ADD COLUMN IF NOT EXISTS result_note  text;

-- Scores entiers positifs et bornés (garde-fou anti-saisie aberrante).
ALTER TABLE public.team_matches
  DROP CONSTRAINT IF EXISTS team_matches_home_score_range;
ALTER TABLE public.team_matches
  ADD CONSTRAINT team_matches_home_score_range CHECK (
    home_score IS NULL OR (home_score >= 0 AND home_score <= 99)
  );

ALTER TABLE public.team_matches
  DROP CONSTRAINT IF EXISTS team_matches_away_score_range;
ALTER TABLE public.team_matches
  ADD CONSTRAINT team_matches_away_score_range CHECK (
    away_score IS NULL OR (away_score >= 0 AND away_score <= 99)
  );

ALTER TABLE public.team_matches
  DROP CONSTRAINT IF EXISTS team_matches_result_note_length;
ALTER TABLE public.team_matches
  ADD CONSTRAINT team_matches_result_note_length CHECK (
    result_note IS NULL OR length(result_note) <= 2000
  );

COMMIT;
