// Jest has no vi.stubGlobal; this keeps the same "stub now, restore everything in afterEach" shape.
const originals = new Map<string, PropertyDescriptor | undefined>();

export function stubGlobal(name: string, value: unknown): void {
  if (!originals.has(name)) originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
}

export function unstubAllGlobals(): void {
  originals.forEach((descriptor, name) => {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete (globalThis as Record<string, unknown>)[name];
  });
  originals.clear();
}
