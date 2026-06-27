-- Username automatique façon LinkedIn : prénom + nom, suffixe numérique si le
-- handle existe déjà. Le username reste un identifiant public, jamais la clé
-- métier : les relations utilisent toujours auth.users.id.

BEGIN;

CREATE OR REPLACE FUNCTION private.username_slug(p_value text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO 'public'
AS $$
  SELECT trim(both '-' from regexp_replace(
    translate(
      lower(coalesce(p_value, '')),
      'àáâäãåāăąçćčďèéêëēėęěìíîïīįłñńňòóôöõøōřŕšśșťțùúûüūůűųýÿžźż',
      'aaaaaaaaacccdeeeeeeeeiiiiiilnnnooooooorrsssttuuuuuuuuyyzzz'
    ),
    '[^a-z0-9]+',
    '-',
    'g'
  ))
$$;

CREATE OR REPLACE FUNCTION private.generated_username_available(p_username text, p_user_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT p_username ~ '^[a-z0-9_.-]{3,30}$'
     AND NOT EXISTS (
       SELECT 1 FROM public.profiles
        WHERE lower(username) = lower(p_username)
          AND id <> p_user_id
     )
$$;

CREATE OR REPLACE FUNCTION private.generate_username(p_first_name text, p_last_name text, p_user_id uuid)
  RETURNS text
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_base text;
  v_candidate text;
  v_suffix integer := 1;
  v_suffix_text text;
BEGIN
  v_base := private.username_slug(concat_ws('-', p_first_name, p_last_name));

  IF length(v_base) < 3 THEN
    v_base := 'user';
  END IF;

  v_base := left(v_base, 30);
  v_candidate := v_base;

  WHILE NOT private.generated_username_available(v_candidate, p_user_id) LOOP
    v_suffix := v_suffix + 1;
    v_suffix_text := '-' || v_suffix::text;
    v_candidate := left(v_base, 30 - length(v_suffix_text)) || v_suffix_text;
  END LOOP;

  RETURN v_candidate;
END;
$$;

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
BEGIN
  IF pref NOT IN ('staff', 'player', 'dual', 'parent') THEN
    pref := 'staff';
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
        first_name, last_name, birth_date, phone, username
      )
      VALUES (
        new.id, v_name, pref, v_avatar,
        v_first, v_last, v_dob, v_phone, v_username
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
