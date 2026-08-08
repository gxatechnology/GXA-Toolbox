import '@testing-library/jest-dom/vitest';

if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, 'crypto', { value: { randomUUID: () => 'test-id' }, configurable: true });
}
