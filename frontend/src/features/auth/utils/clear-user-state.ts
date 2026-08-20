const USER_STATE_PREFIXES = ["life-management:", "life-management."];

export function clearUserLocalState(storage?: Pick<Storage, "length" | "key" | "removeItem"> | null): void {
  if (!storage) return;
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key && USER_STATE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      keys.push(key);
    }
  }
  keys.forEach((key) => storage.removeItem(key));
}
