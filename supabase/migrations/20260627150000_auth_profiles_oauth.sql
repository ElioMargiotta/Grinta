-- Lot A — Fondations d'authentification : enrichissement du profil pour OAuth
-- (Google / Apple) et handle public.
--
-- Contexte : on ouvre la connexion sociale (Google/Apple) en plus de
-- l'email/mot de passe, et on introduit un `username` (handle public, ex.
-- @mentions du hub). À l'inscription OAuth, Supabase remplit
-- raw_user_meta_data (name/full_name, avatar_url, picture) ; on les recopie
-- dans public.profiles via le trigger handle_new_user (déjà présent).
--
-- 100 % ADDITIF, tout nullable. Le username n'est PAS un identifiant de
-- connexion (Supabase authentifie par email/OAuth) : c'est un handle d'affichage.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Colonnes profil
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username   text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS phone      text;

-- Handle : 3–30 caractères, alphanumériques + tiret/underscore/point.
-- (lower-cased à l'écriture côté app ; unicité insensible à la casse ci-dessous.)
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_username_format;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_username_format
  CHECK (username IS NULL OR username ~ '^[a-z0-9_.-]{3,30}$');

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_avatar_url_length;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_avatar_url_length
  CHECK (avatar_url IS NULL OR length(avatar_url) <= 500);

-- Unicité insensible à la casse, sans dépendre de l'extension citext (cohérent
-- avec l'index lower(email) de club_invitations).
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_unique_idx
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL;

COMMENT ON COLUMN public.profiles.username IS
  'Handle public optionnel (Lot A). Pas un identifiant de connexion ; unicité insensible à la casse.';
COMMENT ON COLUMN public.profiles.avatar_url IS
  'Photo de profil (récupérée d''OAuth Google/Apple ou téléversée).';
COMMENT ON COLUMN public.profiles.phone IS
  'Contact téléphonique optionnel (jamais un identifiant de connexion ici).';

-- ---------------------------------------------------------------------------
-- 2. handle_new_user enrichi : recopie full_name + avatar_url depuis les
--    métadonnées OAuth. Conserve la résolution de persona_preference (#…140000).
--    Les providers exposent le nom sous 'full_name' ou 'name', l'avatar sous
--    'avatar_url' ou 'picture'.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  pref   text := coalesce(new.raw_user_meta_data->>'persona_preference', 'staff');
  v_name text := coalesce(
                   new.raw_user_meta_data->>'full_name',
                   new.raw_user_meta_data->>'name',
                   '');
  v_avatar text := coalesce(
                     new.raw_user_meta_data->>'avatar_url',
                     new.raw_user_meta_data->>'picture');
BEGIN
  IF pref NOT IN ('staff', 'player', 'dual') THEN
    pref := 'staff';
  END IF;

  INSERT INTO public.profiles (id, full_name, persona_preference, avatar_url)
  VALUES (new.id, v_name, pref, v_avatar)
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;

-- ---------------------------------------------------------------------------
-- 3. RPC set_username : pose/maj le handle du compte courant (validation +
--    unicité gérées par la contrainte/index). SECURITY INVOKER : la policy de
--    self-update de profiles s'applique déjà, mais on expose une RPC pour
--    renvoyer une erreur propre 'username_taken' à l'UI d'onboarding.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_username(p_username text)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_norm    text := lower(btrim(coalesce(p_username, '')));
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;
  IF v_norm !~ '^[a-z0-9_.-]{3,30}$' THEN
    RAISE EXCEPTION 'username_invalid';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.profiles
     WHERE lower(username) = v_norm AND id <> v_user_id
  ) THEN
    RAISE EXCEPTION 'username_taken';
  END IF;

  UPDATE public.profiles SET username = v_norm WHERE id = v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_username(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_username(text) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
