import type { NextConfig } from "next";

import { resolveNextDistDir } from "./resolve-next-dist-dir";

const distDir = resolveNextDistDir(process.env.NODE_ENV, process.env.NEXT_DIST_DIR);

const nextConfig: NextConfig = {
  distDir,
};

export default nextConfig;
