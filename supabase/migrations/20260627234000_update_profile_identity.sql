-- Mise à jour des informations personnelles du compte.
-- Le username reste généré automatiquement depuis prénom + nom.

BEGIN;

CREATE OR REPLACE FUNCTION public.update_my_profile_identity(
  p_first_name text,
  p_last_name text,
  p_birth_date date DEFAULT NULL,
  p_phone text DEFAULT NULL
)
  RETURNS TABLE(username text)
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_first text := nullif(btrim(coalesce(p_first_name, '')), '');
  v_last text := nullif(btrim(coalesce(p_last_name, '')), '');
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_username text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;
  IF v_first IS NULL OR v_last IS NULL THEN
    RAISE EXCEPTION 'missing_name';
  END IF;

  -- Libère le handle actuel pour permettre de garder le même si le slug ne
  -- change pas, puis recalcule avec le suffixe disponible.
  UPDATE public.profiles
     SET username = NULL
   WHERE id = v_user_id;

  v_username := private.generate_username(v_first, v_last, v_user_id);

  UPDATE public.profiles
     SET first_name = v_first,
         last_name = v_last,
         full_name = btrim(concat_ws(' ', v_first, v_last)),
         birth_date = p_birth_date,
         phone = v_phone,
         username = v_username
   WHERE id = v_user_id;

  RETURN QUERY SELECT v_username;
END;
$$;

REVOKE ALL ON FUNCTION public.update_my_profile_identity(text, text, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_my_profile_identity(text, text, date, text) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
