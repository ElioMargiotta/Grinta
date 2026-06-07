"use server";

import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";

export async function requestPasswordResetAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const locale = String(formData.get("locale") ?? "fr");

  if (email) {
    const supabase = await createClient();
    // The recovery email link is a PKCE `?code=` URL; we land it on our
    // /auth/callback route handler, which exchanges the code for a session
    // (using the verifier cookie set here) before redirecting to the form.
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${getSiteUrl()}/${locale}/auth/callback?next=/reset-password`,
    });
  }

  // Always report success — never reveal whether an account exists for this
  // address (avoids email enumeration). Supabase's own rate limiting throttles
  // repeated requests (see supabase/config.toml → auth.rate_limit.email_sent).
  return { sent: true as const };
}
