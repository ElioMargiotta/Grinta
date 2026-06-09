-- Logos de club — bucket Supabase Storage
--
-- Jusqu'ici le logo était une URL https saisie à la main. On veut un import de
-- fichier (PNG/JPEG). On crée un bucket public `club-logos` ; le logo est
-- stocké sous `{club_id}/logo-<ts>.<ext>` et l'URL publique est enregistrée
-- dans `clubs.logo_url`. Lecture publique (affichage), écriture réservée aux
-- gestionnaires (`full`) du club correspondant au 1er segment du chemin.

BEGIN;

INSERT INTO storage.buckets (id, name, public)
VALUES ('club-logos', 'club-logos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS club_logos_read   ON storage.objects;
DROP POLICY IF EXISTS club_logos_insert ON storage.objects;
DROP POLICY IF EXISTS club_logos_update ON storage.objects;
DROP POLICY IF EXISTS club_logos_delete ON storage.objects;

-- Lecture : bucket public (affichage du logo partout dans l'app).
CREATE POLICY club_logos_read
  ON storage.objects FOR SELECT
  USING (bucket_id = 'club-logos');

-- Écriture : gestionnaire (`full`) du club = 1er dossier du chemin.
CREATE POLICY club_logos_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'club-logos'
    AND private.user_club_access(((storage.foldername(name))[1])::uuid) = 'full'::public.access_level
  );

CREATE POLICY club_logos_update
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'club-logos'
    AND private.user_club_access(((storage.foldername(name))[1])::uuid) = 'full'::public.access_level
  )
  WITH CHECK (
    bucket_id = 'club-logos'
    AND private.user_club_access(((storage.foldername(name))[1])::uuid) = 'full'::public.access_level
  );

CREATE POLICY club_logos_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'club-logos'
    AND private.user_club_access(((storage.foldername(name))[1])::uuid) = 'full'::public.access_level
  );

COMMIT;
