import type { NextConfig } from "next";

const backendUrl = process.env.BACKEND_URL ?? "http://localhost:5000";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Every route in the `(app)` group is a client component gated on
    // `/api/auth/me`, so the server never renders a page segment there and
    // instant-navigation validation can only ever report "dropped segment".
    // `instant = false` cannot be exported from a client component, so only
    // validate segments that explicitly opt in with `export const instant`.
    instantInsights: {
      validationLevel: "manual-warning",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    // The browser talks to Next.js on :3000; Next proxies /api to Express on
    // :5000. This keeps the auth cookies first-party (same origin).
    return [{ source: "/api/:path*", destination: `${backendUrl}/api/:path*` }];
  },
};

export default nextConfig;
