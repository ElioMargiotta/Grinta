import "server-only";

/**
 * Resolves the public base URL for the current environment, used to build
 * absolute links (auth email redirects, club invitations, …).
 *
 * Priority:
 *   1. Vercel Production → the canonical public domain, hardcoded so a missing
 *      or stale NEXT_PUBLIC_SITE_URL can never make auth emails redirect to a
 *      non-allow-listed *.vercel.app URL (Supabase then silently falls back to
 *      the Site URL root, breaking the confirm flow).
 *   2. Vercel Preview → the deployment's own stable per-branch URL, so a
 *      pushed branch can be tested fully online (auth lands back on the
 *      preview site, not localhost or production).
 *   3. Explicit NEXT_PUBLIC_SITE_URL → local (.env.local) and any other
 *      environment where a fixed domain is configured.
 *   4. Other Vercel deploys → the unique deployment URL.
 *   5. Local fallback.
 *
 * VERCEL_* vars are injected by Vercel automatically and are server-only,
 * which is why this module is server-only.
 */
const PRODUCTION_SITE_URL = "https://grintaclub.app";

export function getSiteUrl(): string {
  if (process.env.VERCEL_ENV === "production") {
    return PRODUCTION_SITE_URL;
  }

  if (process.env.VERCEL_ENV === "preview") {
    const branchUrl = process.env.VERCEL_BRANCH_URL ?? process.env.VERCEL_URL;
    if (branchUrl) return `https://${branchUrl}`;
  }

  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}
