/**
 * The site's own address. Vercel supplies its production hostname at build
 * time; set NEXT_PUBLIC_SITE_URL once there is a real domain.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ||
  "http://localhost:3000";
