"use server";

import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const CODE_COUNT = 10;

/** Code lisible : 10 caractères hex groupés, ex. "A1B2C-3D4E5". */
function generateCode(): string {
  const raw = crypto.randomBytes(8).toString("hex").toUpperCase().slice(0, 10);
  return `${raw.slice(0, 5)}-${raw.slice(5, 10)}`;
}

/** Normalise (majuscules, sans séparateurs) puis hashe en SHA-256. */
function hashCode(code: string): string {
  const normalized = code.toUpperCase().replace(/[^0-9A-Z]/g, "");
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

/** Vérifie un code TOTP CÔTÉ SERVEUR (preuve de possession réelle). */
async function verifyTotpServer(
  supabase: SupabaseClient,
  factorId: string,
  code: string,
): Promise<boolean> {
  const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({
    factorId,
  });
  if (cErr || !challenge) return false;
  const { error: vErr } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code,
  });
  return !vErr;
}

/**
 * Génère un nouveau lot de codes de secours. Exige un code TOTP frais vérifié
 * côté serveur : sans l'application d'authentification, impossible de créer de
 * nouveaux codes (sinon on contournerait la protection de désactivation).
 */
export async function generateRecoveryCodesAction(formData: FormData) {
  const totpCode = String(formData.get("code") ?? "").trim();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { errorCode: "noSession" as const };

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const totp = factors?.totp?.[0];
  if (!totp) return { errorCode: "noFactor" as const };

  if (!(await verifyTotpServer(supabase, totp.id, totpCode))) {
    return { errorCode: "invalidCode" as const };
  }

  const codes = Array.from({ length: CODE_COUNT }, generateCode);
  const { error } = await supabase.rpc("generate_mfa_recovery_codes", {
    p_hashes: codes.map(hashCode),
  });
  if (error) {
    console.error("[recovery codes] generate failed:", error);
    return { error: error.message };
  }
  return { codes };
}

/**
 * Désactive la 2FA depuis les réglages. Exige une preuve de possession vérifiée
 * côté serveur : un code TOTP (6 chiffres) OU un code de secours (si le
 * téléphone est perdu mais la session encore ouverte).
 */
export async function disableMfaAction(formData: FormData) {
  const input = String(formData.get("code") ?? "").trim();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { errorCode: "noSession" as const };

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const totp = factors?.totp?.[0];
  if (!totp) return { errorCode: "noFactor" as const };

  // 6 chiffres → TOTP ; sinon → code de secours.
  let verified = false;
  if (/^\d{6}$/.test(input)) {
    verified = await verifyTotpServer(supabase, totp.id, input);
  } else {
    const { data: ok } = await supabase.rpc("consume_mfa_recovery_code", {
      p_hash: hashCode(input),
    });
    verified = !!ok;
  }
  if (!verified) return { errorCode: "invalidCode" as const };

  const admin = createServiceClient();
  const { error: delError } = await admin.auth.admin.mfa.deleteFactor({
    id: totp.id,
    userId: user.id,
  });
  if (delError) {
    console.error("[disable mfa] deleteFactor failed:", delError);
    return { error: delError.message };
  }

  // Purge les codes de secours restants (plus de 2FA) puis rafraîchit la
  // session pour repasser proprement en aal1.
  await supabase.rpc("generate_mfa_recovery_codes", { p_hashes: [] });
  await supabase.auth.refreshSession();

  return { success: true as const };
}

/**
 * Consomme un code de secours depuis l'écran /mfa (compte verrouillé hors 2FA).
 * Valide le code → supprime le(s) facteur(s) TOTP via l'API admin → rafraîchit
 * la session (redescend en aal1 sans facteur), débloquant l'accès.
 */
export async function consumeRecoveryCodeAction(formData: FormData) {
  const code = String(formData.get("code") ?? "");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { errorCode: "noSession" as const };

  const { data: ok, error } = await supabase.rpc("consume_mfa_recovery_code", {
    p_hash: hashCode(code),
  });
  if (error) {
    console.error("[recovery codes] consume failed:", error);
    return { error: error.message };
  }
  if (!ok) return { errorCode: "invalidCode" as const };

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const admin = createServiceClient();
  for (const f of factors?.totp ?? []) {
    const { error: delError } = await admin.auth.admin.mfa.deleteFactor({
      id: f.id,
      userId: user.id,
    });
    if (delError) console.error("[recovery codes] deleteFactor:", delError);
  }
  await supabase.auth.refreshSession();

  return { success: true as const };
}
