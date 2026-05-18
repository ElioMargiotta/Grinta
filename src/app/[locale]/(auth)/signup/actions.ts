"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";

export async function signupAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "");
  const locale = String(formData.get("locale") ?? "en");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${getSiteUrl()}/${locale}/confirm`,
    },
  });

  if (error) {
    // Surfaced when email confirmations are disabled.
    if (
      error.code === "user_already_exists" ||
      /already registered|already exists/i.test(error.message)
    ) {
      return { errorCode: "emailExists" as const };
    }
    return { error: error.message };
  }

  // With email confirmations enabled, Supabase obfuscates an existing account:
  // it returns a user with an empty identities array and no error.
  if (data.user && (data.user.identities?.length ?? 0) === 0) {
    return { errorCode: "emailExists" as const };
  }

  if (data.session) {
    redirect(`/${locale}/dashboard`);
  }

  return { needsConfirmation: true };
}
