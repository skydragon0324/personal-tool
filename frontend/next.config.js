const path = require("path");

const { resolveNextDistDir } = require("./resolve-next-dist-dir");

const distDir = resolveNextDistDir(process.env.NODE_ENV, process.env.NEXT_DIST_DIR);

// Packages Node 12 can load as-is during server rendering. Everything else in node_modules ships
// syntax newer than Node 12 (?., ??, private methods), so the server build bundles it and lowers
// it with Babel instead of letting Node require it directly.
const NODE12_SAFE_EXTERNALS = /^(react|react-dom|next|styled-jsx)(\/|$)/;
const SKIP_BABEL = /[\\/]node_modules[\\/](react|react-dom|next|styled-jsx|core-js|@babel)[\\/]/;

/** Relative and absolute requests are left to Next, which keeps its own internals external. */
function isBarePackage(request) {
  return Boolean(request) && !request.startsWith(".") && !path.isAbsolute(request) && !path.posix.isAbsolute(request);
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir,
  reactStrictMode: true,
  experimental: {
    // Let <Link> render its own <a> (the Next 13+ behaviour the components are written for).
    newNextLinkBehavior: true,
  },
  webpack(config, { isServer, webpack }) {
    if (!isServer) return config;
    config.plugins.push(
      // @dnd-kit subclasses AbortController at import time; Node 12 has no global one.
      new webpack.ProvidePlugin({
        AbortController: ["abort-controller", "AbortController"],
        AbortSignal: ["abort-controller", "AbortSignal"],
      }),
    );
    config.externals = config.externals.map((external) =>
      typeof external === "function"
        ? (data, ...rest) =>
            isBarePackage(data.request) && !NODE12_SAFE_EXTERNALS.test(data.request)
              ? Promise.resolve()
              : external(data, ...rest)
        : external,
    );
    config.module.rules.push({
      test: /\.(c|m)?js$/,
      include: /[\\/]node_modules[\\/]/,
      exclude: SKIP_BABEL,
      use: {
        loader: "babel-loader",
        options: {
          babelrc: false,
          configFile: false,
          cacheDirectory: true,
          sourceType: "unambiguous",
          presets: [["@babel/preset-env", { targets: { node: "12.22" }, modules: false }]],
        },
      },
    });
    return config;
  },
  async redirects() {
    return [
      { source: "/", destination: "/today", permanent: false },
      { source: "/inbox", destination: "/today", permanent: false },
    ];
  },
};

module.exports = nextConfig;
