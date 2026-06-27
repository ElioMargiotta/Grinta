-- Annuaire comptes utilisateurs + normalisation des handles existants au format
-- prenom-nom, prenom-nom-2, etc.

BEGIN;

CREATE OR REPLACE FUNCTION public.search_user_accounts(p_query text, p_limit integer DEFAULT 8)
  RETURNS TABLE(user_id uuid, username text, full_name text)
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT p.id, p.username, p.full_name
    FROM public.profiles p
   WHERE auth.uid() IS NOT NULL
     AND p.username IS NOT NULL
     AND length(btrim(coalesce(p_query, ''))) >= 2
     AND (
       lower(p.username) LIKE lower(replace(btrim(p_query), '@', '')) || '%'
       OR lower(coalesce(p.full_name, '')) LIKE '%' || lower(btrim(p_query)) || '%'
     )
   ORDER BY
     CASE
       WHEN lower(p.username) = lower(replace(btrim(p_query), '@', '')) THEN 0
       WHEN lower(p.username) LIKE lower(replace(btrim(p_query), '@', '')) || '%' THEN 1
       ELSE 2
     END,
     p.full_name NULLS LAST,
     p.username
   LIMIT greatest(1, least(coalesce(p_limit, 8), 20))
$$;

REVOKE ALL ON FUNCTION public.search_user_accounts(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_user_accounts(text, integer) TO authenticated;

DO $$
DECLARE
  r record;
  v_username text;
BEGIN
  -- On repart de NULL pour recalculer tous les handles existants avec la même
  -- règle que les nouveaux comptes. Les relations applicatives restent sur id.
  UPDATE public.profiles SET username = NULL;

  FOR r IN
    SELECT id, first_name, last_name, full_name
      FROM public.profiles
     ORDER BY coalesce(full_name, ''), id
  LOOP
    v_username := private.generate_username(
      coalesce(r.first_name, split_part(coalesce(r.full_name, ''), ' ', 1)),
      coalesce(
        r.last_name,
        nullif(btrim(regexp_replace(coalesce(r.full_name, ''), '^\S+\s*', '')), '')
      ),
      r.id
    );

    UPDATE public.profiles
       SET username = v_username
     WHERE id = r.id;
  END LOOP;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
