import type { NextConfig } from "next";

const backendUrl = process.env.BACKEND_URL ?? "http://localhost:5000";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
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
