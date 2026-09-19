/**
 * The site's own address. Vercel supplies its production hostname at build
 * time; set NEXT_PUBLIC_SITE_URL once there is a real domain.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ||
  "http://localhost:3000";

/**
 * The project's account on X.
 *
 * Written here rather than only on the account, because the useful direction is
 * this one: anybody can make an account that says it is Quadpad, and the only
 * thing that separates the real one is that the site nobody else controls
 * points at it. The footer links it on every page for that reason.
 */
export const X_HANDLE = "Quadpadxyz";
export const X_URL = `https://x.com/${X_HANDLE}`;
