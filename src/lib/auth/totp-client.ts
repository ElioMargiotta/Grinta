"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Step-up TOTP côté client : re-prouve la possession du téléphone juste avant
 * une action sensible (changement de mot de passe / email). Mutualisé entre les
 * sections du compte.
 */
export async function verifyTotpStepUp(
  factorId: string,
  code: string,
): Promise<{ ok: true } | { ok: false; reason: "challenge" | "code" }> {
  const supabase = createClient();
  const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({
    factorId,
  });
  if (cErr || !challenge) {
    console.error("[totp step-up] challenge", cErr);
    return { ok: false, reason: "challenge" };
  }
  const { error: vErr } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code,
  });
  if (vErr) {
    console.error("[totp step-up] verify", vErr);
    return { ok: false, reason: "code" };
  }
  return { ok: true };
}
