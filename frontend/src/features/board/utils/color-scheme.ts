export const COLOR_SCHEME_STORAGE_KEYS = [
  "mantine-color-scheme",
  "mantine-color-scheme-value",
] as const;

export function normalizeStoredColorScheme(storage: {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}): void {
  for (const key of COLOR_SCHEME_STORAGE_KEYS) {
    if (storage.getItem(key) === "auto") {
      storage.setItem(key, "light");
    }
  }
}

export const NORMALIZE_COLOR_SCHEME_SCRIPT = `try{${COLOR_SCHEME_STORAGE_KEYS.map(
  (key) =>
    `if(localStorage.getItem(${JSON.stringify(key)})==="auto")localStorage.setItem(${JSON.stringify(key)},"light");`,
).join("")}}catch(e){}`;
