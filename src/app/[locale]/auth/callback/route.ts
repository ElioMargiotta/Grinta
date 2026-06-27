import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth/PKCE callback. Supabase appends `?code=...` to this URL after:
 *   - a social sign-in (Google/Apple — `next` defaults to /dashboard), or
 *   - a recovery email link (caller passes `next=/reset-password`).
 * We exchange the code for a session (the verifier cookie was set when the
 * flow started, in this same browser) then redirect to the localized `next`.
 * On failure we route recovery flows back to /reset-password and everything
 * else to /login, each with an `error` flag the page can surface.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const rawNext = url.searchParams.get("next") ?? "/dashboard";
  const next = rawNext.startsWith("/") ? rawNext : "/dashboard";
  const isRecovery = next.startsWith("/reset-password");

  const errorRedirect = isRecovery
    ? new URL(`/${locale}/reset-password?error=link`, url.origin)
    : new URL(`/${locale}/login?error=auth`, url.origin);

  if (!code) {
    return NextResponse.redirect(errorRedirect);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(errorRedirect);
  }

  return NextResponse.redirect(new URL(`/${locale}${next}`, url.origin));
}
