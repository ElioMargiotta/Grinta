-- Coach-controlled disclosure of TIPS reports to the linked player.
-- By default, evaluations are not visible to the player account.

BEGIN;

ALTER TABLE public.player_evaluations
  ADD COLUMN IF NOT EXISTS shared_with_player boolean NOT NULL DEFAULT false;

-- Lecture par le joueur lié : uniquement les évaluations partagées.
DROP POLICY IF EXISTS player_evaluations_read_self ON public.player_evaluations;
CREATE POLICY player_evaluations_read_self
  ON public.player_evaluations FOR SELECT
  USING (
    shared_with_player = true
    AND EXISTS (
      SELECT 1 FROM public.players p
       WHERE p.id = player_evaluations.player_id
         AND p.user_id = (SELECT auth.uid())
    )
  );

COMMIT;
