-- Lot C — Valeur d'enum 'guardian' pour les invitations parent/tuteur.
--
-- DOIT être dans sa propre migration : Postgres interdit d'utiliser une
-- nouvelle valeur d'enum dans la même transaction que son ALTER TYPE ... ADD
-- VALUE. La table player_guardians, la contrainte et les RPC qui référencent
-- 'guardian' vivent donc dans la migration suivante (20260627170100).

ALTER TYPE public.invitation_kind ADD VALUE IF NOT EXISTS 'guardian';
