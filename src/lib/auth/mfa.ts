import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Niveau d'assurance d'authentification de la session courante.
 *  - `currentLevel`  : niveau atteint (aal1 = mot de passe ; aal2 = + 2FA).
 *  - `nextLevel`     : niveau requis. Vaut `aal2` dès qu'un facteur TOTP est
 *                      VÉRIFIÉ sur le compte ; sinon `aal1`.
 * Caché par requête pour ne pas multiplier l'appel dans les gardes.
 */
export const getAalState = cache(
  async (): Promise<{ currentLevel: string | null; nextLevel: string | null }> => {
    try {
      const supabase = await createClient();
      const { data, error } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (error || !data) return { currentLevel: null, nextLevel: null };
      return { currentLevel: data.currentLevel, nextLevel: data.nextLevel };
    } catch {
      // Réponse MFA inattendue (projet sans MFA, réseau) : ne pas bloquer le
      // rendu — on considère qu'aucun challenge n'est requis.
      return { currentLevel: null, nextLevel: null };
    }
  },
);

/**
 * Vrai quand le compte a activé la 2FA (facteur vérifié) mais que la session
 * n'a pas encore passé le challenge TOTP — il faut alors rediriger vers /mfa.
 */
export async function mfaChallengeRequired(): Promise<boolean> {
  const { currentLevel, nextLevel } = await getAalState();
  return currentLevel === "aal1" && nextLevel === "aal2";
}
