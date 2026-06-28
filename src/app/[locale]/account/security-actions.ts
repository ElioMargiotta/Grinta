"use server";

import { createClient as createPlainClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getAalState } from "@/lib/auth/mfa";
import { isStrongPassword } from "@/lib/auth/password";
import { getSiteUrl } from "@/lib/site-url";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Vérifie le mot de passe actuel SANS toucher la session courante : un
 * `signInWithPassword` sur le client SSR ferait retomber une session 2FA en
 * aal1. On utilise donc un client jetable, sans persistance.
 */
async function verifyCurrentPassword(
  email: string,
  password: string,
): Promise<{ ok: boolean; wrongCredentials: boolean; message?: string }> {
  const isolated = createPlainClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  // NE PAS signOut() : par défaut scope='global', ça révoquerait TOUTES les
  // sessions du compte (y compris la vraie, par cookies) → "Auth session
  // missing!" au updateUser suivant. La session isolée vit en mémoire et est
  // jetée à la fin de la fonction (persistSession:false).
  const { error } = await isolated.auth.signInWithPassword({ email, password });
  if (!error) return { ok: true, wrongCredentials: false };
  const wrongCredentials =
    error.code === "invalid_credentials" ||
    /invalid login credentials/i.test(error.message);
  console.error("[changePassword] verify current password failed:", error);
  return { ok: false, wrongCredentials, message: error.message };
}

/** Gate partagé : mot de passe actuel valide + AAL2 si la 2FA est activée. */
async function passReauthGate(
  email: string,
  currentPassword: string,
): Promise<
  | { ok: true }
  | { ok: false; errorCode: "wrongPassword" | "mfaRequired" }
  | { ok: false; error: string }
> {
  // Si un facteur TOTP est vérifié, la session DOIT être aal2 (le challenge a
  // été passé au login). On le réaffirme ici par défense en profondeur.
  const { currentLevel, nextLevel } = await getAalState();
  if (nextLevel === "aal2" && currentLevel !== "aal2") {
    return { ok: false, errorCode: "mfaRequired" };
  }
  const verify = await verifyCurrentPassword(email, currentPassword);
  if (!verify.ok) {
    // Vrai mauvais mot de passe → message dédié ; tout autre échec (captcha,
    // rate-limit…) → on remonte le message brut pour le diagnostic.
    return verify.wrongCredentials
      ? { ok: false, errorCode: "wrongPassword" }
      : { ok: false, error: verify.message ?? "verification failed" };
  }
  return { ok: true };
}

export async function changePasswordAction(formData: FormData) {
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");

  if (!isStrongPassword(newPassword)) {
    return { errorCode: "weakPassword" as const };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { errorCode: "noSession" as const };

  const gate = await passReauthGate(user.email, currentPassword);
  if (!gate.ok) {
    return "errorCode" in gate
      ? { errorCode: gate.errorCode }
      : { error: gate.error };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    console.error("[changePassword] updateUser failed:", error);
    return { error: error.message };
  }

  return { success: true as const };
}

export async function changeEmailAction(formData: FormData) {
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newEmail = String(formData.get("newEmail") ?? "").trim().toLowerCase();
  const locale = String(formData.get("locale") ?? "fr");

  if (!EMAIL_RE.test(newEmail)) {
    return { errorCode: "invalidEmail" as const };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { errorCode: "noSession" as const };

  if (newEmail === user.email.toLowerCase()) {
    return { errorCode: "sameEmail" as const };
  }

  const gate = await passReauthGate(user.email, currentPassword);
  if (!gate.ok) {
    return "errorCode" in gate
      ? { errorCode: gate.errorCode }
      : { error: gate.error };
  }

  // double_confirm_changes=true → Supabase envoie une confirmation à l'ancien
  // ET au nouvel email ; le changement n'est effectif qu'une fois les deux
  // cliqués. Les liens atterrissent sur /confirm.
  const { error } = await supabase.auth.updateUser(
    { email: newEmail },
    { emailRedirectTo: `${getSiteUrl()}/${locale}/confirm` },
  );
  if (error) {
    console.error("[changeEmail] updateUser failed:", error);
    return { error: error.message };
  }

  return { success: true as const };
}
