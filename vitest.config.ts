import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    exclude: ["**/node_modules/**", "tests/net/**"], // emulator suites run via test:emulator
    environment: "node", // UI test files opt into jsdom via a per-file docblock
    setupFiles: ["tests/setup-dom.ts"],
  },
});
