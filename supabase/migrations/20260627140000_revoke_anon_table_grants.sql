-- Sécurité (défense en profondeur) — révoque l'accès direct du rôle `anon` aux
-- tables du schéma `public`.
--
-- Contexte : l'export de schéma Supabase pose par défaut `GRANT ALL ... TO anon`
-- sur chaque table. La RLS (active sur 100% des tables) bloque déjà l'accès réel,
-- et AUCUNE policy ne cible le rôle `anon` : tout l'accès non authentifié
-- légitime (flux d'invitation) passe par des RPC SECURITY DEFINER, jamais par un
-- accès table direct. Retirer ces grants supprime un garde-fou redondant : si une
-- policy venait à manquer sur une nouvelle table, `anon` n'aurait de toute façon
-- aucun privilège table à exploiter.
--
-- Audit : VICE #108 — finding "GRANT ALL ON TABLE ... TO anon".

BEGIN;

-- Révoque tous les privilèges de `anon` sur les tables de base existantes.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT format('%I.%I', schemaname, tablename) AS rel
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE %s FROM anon', r.rel);
  END LOOP;
END$$;

-- Empêche les futures tables créées par le rôle courant d'accorder
-- automatiquement des privilèges à `anon`.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;

COMMIT;

NOTIFY pgrst, 'reload schema';
