import type { NextConfig } from "next";

/**
 * One canonical host.
 *
 * `quadpad.fun` and `www.quadpad.fun` are both attached to the project and both
 * verified, so without this they both serve the site and every link to it is
 * one of two addresses. The apex is the one in the profile and on the token
 * cards, so www redirects to it — permanently, because it is not going to
 * change back.
 *
 * It lives here rather than in the project's domain settings for the reason
 * `DEPLOYED_FACTORY` does: a dashboard toggle is not in the diff, is not in the
 * clone, and is not in anybody's review. This is.
 *
 * `quadpad-phi.vercel.app` is deliberately left alone. It is the project's own
 * host — Vercel's deploy previews and the dashboard both use it, and redirecting
 * it would break them for nothing.
 */
const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.quadpad.fun" }],
        destination: "https://quadpad.fun/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
