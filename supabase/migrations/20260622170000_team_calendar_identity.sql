-- Nom exact de l'équipe tel qu'il apparaît dans son calendrier ICS.
-- Distinct du nom d'affichage Grinta, afin de déduire domicile / extérieur.
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS calendar_team_name text;
