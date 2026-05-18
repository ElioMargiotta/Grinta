import "server-only";

/**
 * Resolves the public base URL for the current environment, used to build
 * absolute links (auth email redirects, club invitations, …).
 *
 * Priority:
 *   1. Vercel Preview → the deployment's own stable per-branch URL, so a
 *      pushed branch can be tested fully online (auth lands back on the
 *      preview site, not localhost or production).
 *   2. Explicit NEXT_PUBLIC_SITE_URL → local (.env.local) and the Vercel
 *      Production scope, where a fixed domain is configured.
 *   3. Other Vercel deploys → the unique deployment URL.
 *   4. Local fallback.
 *
 * VERCEL_* vars are injected by Vercel automatically and are server-only,
 * which is why this module is server-only.
 */
export function getSiteUrl(): string {
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
