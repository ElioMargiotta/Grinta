-- Refonte création de compte : identité riche + 3 types de compte + username
-- obligatoire (façon LinkedIn : vrai nom affiché, handle unique pour retrouver
-- et inviter les gens).
--
-- 1. profiles : prénom/nom séparés + date de naissance (le téléphone, l'avatar
--    et le username existent déjà depuis 20260627150000).
-- 2. persona_preference : ajoute 'parent' (entraîneur=staff, joueur=player,
--    parent=parent — vue portail comme un joueur).
-- 3. is_username_available : check live de dispo (form signup), insensible casse.
-- 4. handle_new_user : recopie tous les champs depuis raw_user_meta_data, pose
--    le username s'il est libre (sinon NULL → l'utilisateur le choisira plus
--    tard, le compte n'échoue jamais à cause d'une course sur le handle).

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Colonnes identité
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name  text,
  ADD COLUMN IF NOT EXISTS birth_date date;

-- ---------------------------------------------------------------------------
-- 2. persona_preference : + 'parent'
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_persona_preference_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_persona_preference_check
  CHECK (persona_preference IN ('staff', 'player', 'dual', 'parent'));

-- ---------------------------------------------------------------------------
-- 3. is_username_available : libre ET format valide (3–30, a-z0-9._-)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_username_available(p_username text)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT lower(btrim(coalesce(p_username, ''))) ~ '^[a-z0-9_.-]{3,30}$'
     AND NOT EXISTS (
       SELECT 1 FROM public.profiles
        WHERE lower(username) = lower(btrim(p_username))
     )
$$;

REVOKE ALL ON FUNCTION public.is_username_available(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_username_available(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. handle_new_user enrichi
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  md       jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  pref     text  := coalesce(md->>'persona_preference', 'staff');
  v_first  text  := nullif(btrim(coalesce(md->>'first_name', '')), '');
  v_last   text  := nullif(btrim(coalesce(md->>'last_name', '')), '');
  v_name   text  := coalesce(
                      nullif(btrim(coalesce(md->>'full_name', '')), ''),
                      nullif(btrim(coalesce(md->>'name', '')), ''),
                      btrim(concat_ws(' ', v_first, v_last)),
                      '');
  v_avatar text  := coalesce(md->>'avatar_url', md->>'picture');
  v_phone  text  := nullif(btrim(coalesce(md->>'phone', '')), '');
  v_user   text  := lower(btrim(coalesce(md->>'username', '')));
  v_dob    date;
BEGIN
  IF pref NOT IN ('staff', 'player', 'dual', 'parent') THEN
    pref := 'staff';
  END IF;

  BEGIN
    v_dob := nullif(md->>'birth_date', '')::date;
  EXCEPTION WHEN others THEN
    v_dob := NULL;
  END;

  INSERT INTO public.profiles (
    id, full_name, persona_preference, avatar_url,
    first_name, last_name, birth_date, phone, username
  )
  VALUES (
    new.id, v_name, pref, v_avatar,
    v_first, v_last, v_dob, v_phone,
    -- Pose le handle seulement s'il est valide ET libre — jamais d'échec de
    -- signup à cause d'une course ; l'utilisateur le choisira sinon plus tard.
    CASE
      WHEN v_user ~ '^[a-z0-9_.-]{3,30}$'
       AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = v_user)
      THEN v_user
      ELSE NULL
    END
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
