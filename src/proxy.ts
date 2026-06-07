import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/supabase/middleware";

const intlMiddleware = createIntlMiddleware(routing);

const PUBLIC_PATHS = new Set([
  "",
  "login",
  "signup",
  "invite",
  "confirm",
  "forgot-password",
  "reset-password",
  "auth",
]);
const PUBLIC_PATHS = new Set(["", "login", "signup", "invite", "confirm", "legal", "contact"]);

export async function proxy(request: NextRequest) {
  const { response: supabaseResponse, user } = await updateSession(request);

  const intlResponse = intlMiddleware(request);

  const finalResponse = intlResponse;
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    finalResponse.cookies.set(cookie.name, cookie.value, cookie);
  });

  const segments = request.nextUrl.pathname.split("/").filter(Boolean);
  const locale = segments[0];
  const firstAfterLocale = segments[1] ?? "";

  const isLocalized = routing.locales.includes(locale as (typeof routing.locales)[number]);
  if (!isLocalized) return finalResponse;

  const isPublic = PUBLIC_PATHS.has(firstAfterLocale);

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    return NextResponse.redirect(url);
  }

  // Don't bounce logged-in users away from /invite/[token] — they may be
  // accepting an invite to a different club from the one they're already in.
  if (
    user &&
    (firstAfterLocale === "login" || firstAfterLocale === "signup")
  ) {
    const next = request.nextUrl.searchParams.get("next");
    const url = request.nextUrl.clone();
    url.search = "";
    url.pathname = next && next.startsWith("/") ? `/${locale}${next}` : `/${locale}/dashboard`;
    return NextResponse.redirect(url);
  }

  return finalResponse;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
