export function nextCliCommand(argv: readonly string[]): string | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    const normalized = argv[index].replace(/\\/g, "/");
    const isNextBin =
      normalized.endsWith("/next") ||
      normalized.endsWith("/next/dist/bin/next") ||
      normalized.endsWith("next/dist/bin/next");
    if (!isNextBin) continue;
    const command = argv[index + 1];
    if (command && !command.startsWith("-")) return command;
  }
  return undefined;
}

export function resolveNextDistDir(
  nodeEnv: string | undefined,
  nextDistDir: string | undefined,
  argv: readonly string[] = process.argv,
): string {
  const command = nextCliCommand(argv);
  if (command === "dev") return ".next-dev";
  if (command === "build" || command === "start") return nextDistDir || ".next";
  if (nodeEnv === "development") return ".next-dev";
  return nextDistDir || ".next";
}
