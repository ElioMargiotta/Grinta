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
      emailRedirectTo: `${getSiteUrl()}/${locale}/dashboard`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (data.session) {
    redirect(`/${locale}/dashboard`);
  }

  return { needsConfirmation: true };
}
