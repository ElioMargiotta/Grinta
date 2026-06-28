import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

const BASE64_PREFIX = "base64-";

function supabaseStorageKey() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;

  try {
    const host = new URL(supabaseUrl).hostname;
    const projectRef = host.split(".")[0];
    return projectRef ? `sb-${projectRef}-auth-token` : null;
  } catch {
    return null;
  }
}

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

async function getStoredAccessToken() {
  const storageKey = supabaseStorageKey();
  if (!storageKey) return null;

  const cookieStore = await cookies();
  const directCookie = cookieStore.get(storageKey)?.value;
  let encoded = directCookie ?? null;

  if (!encoded) {
    const chunks: string[] = [];
    for (let i = 0; ; i++) {
      const chunk = cookieStore.get(`${storageKey}.${i}`)?.value;
      if (!chunk) break;
      chunks.push(chunk);
    }
    encoded = chunks.length > 0 ? chunks.join("") : null;
  }

  if (!encoded) return null;

  const decoded = encoded.startsWith(BASE64_PREFIX)
    ? decodeBase64Url(encoded.slice(BASE64_PREFIX.length))
    : encoded;

  try {
    const session = JSON.parse(decoded) as { access_token?: unknown };
    return typeof session.access_token === "string" ? session.access_token : null;
  } catch {
    return null;
  }
}

function currentAalFromJwt(accessToken: string) {
  try {
    const [, payload] = accessToken.split(".");
    if (!payload) return null;
    const claims = JSON.parse(decodeBase64Url(payload)) as { aal?: unknown };
    return typeof claims.aal === "string" ? claims.aal : null;
  } catch {
    return null;
  }
}

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
      const accessToken = await getStoredAccessToken();
      if (!accessToken) return { currentLevel: null, nextLevel: null };

      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(accessToken);
      if (error || !user) return { currentLevel: null, nextLevel: null };

      const currentLevel = currentAalFromJwt(accessToken);
      const hasVerifiedFactor =
        user.factors?.some((factor) => factor.status === "verified") ?? false;
      return {
        currentLevel,
        nextLevel: hasVerifiedFactor ? "aal2" : currentLevel,
      };
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
