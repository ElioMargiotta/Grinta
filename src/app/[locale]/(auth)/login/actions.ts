"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolvePersona } from "@/lib/club/persona";
import { mfaChallengeRequired } from "@/lib/auth/mfa";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const locale = String(formData.get("locale") ?? "fr");
  // Turnstile injecte ce champ caché dans le form quand le CAPTCHA est actif.
  const captchaToken = String(formData.get("cf-turnstile-response") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
    options: captchaToken ? { captchaToken } : undefined,
  });

  if (error) {
    if (
      error.code === "invalid_credentials" ||
      /invalid login credentials/i.test(error.message)
    ) {
      return { errorCode: "invalidCredentials" as const };
    }
    if (
      error.code === "email_not_confirmed" ||
      /email not confirmed/i.test(error.message)
    ) {
      return { errorCode: "emailNotConfirmed" as const };
    }
    return { error: error.message };
  }

  // 2FA opt-in : si le compte a un facteur TOTP vérifié, la session est en aal1
  // après le mot de passe — on passe par le challenge avant d'entrer dans l'app.
  if (await mfaChallengeRequired()) {
    redirect(`/${locale}/mfa`);
  }

  // Land the user on the right side based on their persona preference, so a
  // "player" account isn't bounced through /dashboard before being redirected
  // to /me.
  const persona = await resolvePersona();
  const target = persona?.active === "player" ? "me" : "dashboard";
  redirect(`/${locale}/${target}`);
}
