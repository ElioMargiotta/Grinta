-- Profils/capacités déclarés du compte.
--
-- Les capacités ne sont PAS des affiliations. Les affiliations restent portées
-- par club_memberships (coach/staff), players.user_id (joueur) et
-- player_guardians (parent/tuteur).

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS can_coach boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_play boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_parent boolean NOT NULL DEFAULT false;

UPDATE public.profiles
   SET can_coach = coalesce(persona_preference, 'staff') IN ('staff', 'dual'),
       can_play = coalesce(persona_preference, 'staff') IN ('player', 'dual'),
       can_parent = coalesce(persona_preference, 'staff') = 'parent';

-- Garantit qu'un compte garde au moins une porte d'entrée.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_at_least_one_capability;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_at_least_one_capability
  CHECK (can_coach OR can_play OR can_parent);

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
                      nullif(btrim(concat_ws(' ', v_first, v_last)), ''),
                      '');
  v_avatar text  := coalesce(md->>'avatar_url', md->>'picture');
  v_phone  text  := nullif(btrim(coalesce(md->>'phone', '')), '');
  v_dob    date;
  v_username text;
  v_attempt integer := 0;
  v_can_coach boolean := coalesce((md->>'can_coach')::boolean, false);
  v_can_play boolean := coalesce((md->>'can_play')::boolean, false);
  v_can_parent boolean := coalesce((md->>'can_parent')::boolean, false);
BEGIN
  IF pref NOT IN ('staff', 'player', 'dual', 'parent') THEN
    pref := 'staff';
  END IF;

  -- Compatibilité avec les clients qui n'envoient que persona_preference.
  IF NOT (v_can_coach OR v_can_play OR v_can_parent) THEN
    v_can_coach := pref IN ('staff', 'dual');
    v_can_play := pref IN ('player', 'dual');
    v_can_parent := pref = 'parent';
  END IF;
  IF NOT (v_can_coach OR v_can_play OR v_can_parent) THEN
    v_can_coach := true;
  END IF;

  BEGIN
    v_dob := nullif(md->>'birth_date', '')::date;
  EXCEPTION WHEN others THEN
    v_dob := NULL;
  END;

  LOOP
    v_attempt := v_attempt + 1;
    v_username := private.generate_username(v_first, v_last, new.id);

    BEGIN
      INSERT INTO public.profiles (
        id, full_name, persona_preference, avatar_url,
        first_name, last_name, birth_date, phone, username,
        can_coach, can_play, can_parent
      )
      VALUES (
        new.id, v_name, pref, v_avatar,
        v_first, v_last, v_dob, v_phone, v_username,
        v_can_coach, v_can_play, v_can_parent
      )
      ON CONFLICT (id) DO NOTHING;

      RETURN new;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempt >= 10 THEN
        RAISE;
      END IF;
    END;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
