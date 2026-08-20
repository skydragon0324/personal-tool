import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the production build out of the running `next dev` cache.
  distDir:
    process.env.NEXT_DIST_DIR ||
    (process.env.NODE_ENV === "development" ? ".next-dev" : ".next"),
};

export default nextConfig;
