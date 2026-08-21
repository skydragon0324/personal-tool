import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  // `next dev` always uses `.next-dev`. NEXT_DIST_DIR is only for production builds
  // so a leftover env var cannot mix a running dev server with `next build`.
  distDir: isDev ? ".next-dev" : process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
