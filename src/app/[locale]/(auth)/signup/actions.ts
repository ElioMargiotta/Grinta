"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";
import { resolvePersona } from "@/lib/club/persona";

export type SignupErrorCode =
  | "emailExists"
  | "weakPassword"
  | "missingFields";

// Standard de sécurité : ≥12 caractères, au moins une minuscule, une majuscule,
// un chiffre et un caractère spécial.
function isStrongPassword(pw: string): boolean {
  return (
    pw.length >= 12 &&
    /[a-z]/.test(pw) &&
    /[A-Z]/.test(pw) &&
    /\d/.test(pw) &&
    /[^A-Za-z0-9]/.test(pw)
  );
}

export async function signupAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const birthDate = String(formData.get("birthDate") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const locale = String(formData.get("locale") ?? "fr");
  const rawPersona = String(formData.get("personaPreference") ?? "staff");
  const personaPreference = (
    ["staff", "player", "parent"] as const
  ).includes(rawPersona as "staff" | "player" | "parent")
    ? rawPersona
    : "staff";
  // Turnstile injecte ce champ caché dans le form quand le CAPTCHA est actif.
  const captchaToken = String(formData.get("cf-turnstile-response") ?? "");

  if (!email || !firstName || !lastName) {
    return { errorCode: "missingFields" as SignupErrorCode };
  }
  if (!isStrongPassword(password)) {
    return { errorCode: "weakPassword" as SignupErrorCode };
  }

  const supabase = await createClient();

  const fullName = `${firstName} ${lastName}`.trim();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        first_name: firstName,
        last_name: lastName,
        birth_date: birthDate || null,
        phone: phone || null,
        persona_preference: personaPreference,
        can_coach: personaPreference === "staff",
        can_play: personaPreference === "player",
        can_parent: personaPreference === "parent",
      },
      emailRedirectTo: `${getSiteUrl()}/${locale}/confirm`,
      ...(captchaToken ? { captchaToken } : {}),
    },
  });

  if (error) {
    if (
      error.code === "user_already_exists" ||
      /already registered|already exists/i.test(error.message)
    ) {
      return { errorCode: "emailExists" as SignupErrorCode };
    }
    if (error.code === "weak_password" || /password/i.test(error.message)) {
      return { errorCode: "weakPassword" as SignupErrorCode };
    }
    return { error: error.message };
  }

  // Avec confirmation email activée, Supabase masque un compte existant :
  // user renvoyé avec identities vide et aucune erreur.
  if (data.user && (data.user.identities?.length ?? 0) === 0) {
    return { errorCode: "emailExists" as SignupErrorCode };
  }

  if (data.session) {
    const persona = await resolvePersona();
    const target = persona?.active === "player" ? "me" : "dashboard";
    redirect(`/${locale}/${target}`);
  }

  return { needsConfirmation: true };
}
