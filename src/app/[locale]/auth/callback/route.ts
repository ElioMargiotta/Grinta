import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth/PKCE callback. Supabase appends `?code=...` to this URL after a
 * recovery (or other) email link is followed; we exchange that code for a
 * session (the code verifier lives in a cookie set when the email was
 * requested, so this works within the same browser) and then redirect to the
 * localized `next` path.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const rawNext = url.searchParams.get("next") ?? "/reset-password";
  const next = rawNext.startsWith("/") ? rawNext : "/reset-password";

  const errorRedirect = new URL(`/${locale}/reset-password`, url.origin);
  errorRedirect.searchParams.set("error", "link");

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
