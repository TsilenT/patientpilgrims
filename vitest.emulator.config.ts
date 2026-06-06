import { defineConfig } from "vitest/config";

// Emulator suites (security rules + transactional adapter). Run via `npm run test:emulator`,
// which wraps this in `firebase emulators:exec`. Kept separate from the default config so
// the no-Java unit gate can exclude tests/net while this config targets exactly those.
export default defineConfig({
  test: {
    include: ["tests/net/**/*.test.ts"],
    environment: "node",
    testTimeout: 15000,
  },
});
