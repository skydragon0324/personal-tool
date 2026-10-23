const nextJest = require("next/jest");

const createJestConfig = nextJest({ dir: "./" });

const customConfig = {
  testEnvironment: "jsdom",
  // Each Node 12 worker compiles node_modules on first run; one per core runs out of memory.
  maxWorkers: 4,
  setupFiles: ["<rootDir>/src/test/polyfills.js"],
  setupFilesAfterEnv: ["<rootDir>/src/test/setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testPathIgnorePatterns: ["/node_modules/", "/.next/", "/.next-dev/", "/.next-prod/"],
};

module.exports = async () => {
  const config = await createJestConfig(customConfig)();
  // Node 12 cannot parse the modern syntax (?. ?? etc.) that current packages ship, so let SWC
  // compile node_modules down to the running Node version too.
  config.transformIgnorePatterns = ["^.+\\.module\\.(css|sass|scss)$"];
  config.transform = {
    // Next 12's SWC leaves private class methods (#method()) alone, which TanStack Query ships and
    // Node 12 cannot parse; Babel's preset-env lowers them.
    "[\\\\/]node_modules[\\\\/]@tanstack[\\\\/].+\\.(c|m)?js$": [
      "babel-jest",
      { presets: [["@babel/preset-env", { targets: { node: "12.22" } }]] },
    ],
    // next/jest only registers SWC for js/jsx/ts/tsx/mjs; packages also ship .cjs builds.
    ...Object.fromEntries(
      Object.entries(config.transform).map(([pattern, transformer]) => [
        pattern === "^.+\\.(js|jsx|ts|tsx|mjs)$" ? "^.+\\.(js|jsx|ts|tsx|mjs|cjs)$" : pattern,
        transformer,
      ]),
    ),
  };
  return config;
};
