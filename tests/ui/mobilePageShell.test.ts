import { readFileSync } from "node:fs";
import { test, expect } from "vitest";

const css = readFileSync(new URL("../../src/ui/styles.css", import.meta.url), "utf8");

test("non-game pages remain document-scrollable when the iOS keyboard opens", () => {
  expect(css).not.toContain("html, body {\n  height: 100%;\n  overflow: hidden;");
  expect(css).toContain("body:has(.game-view)");
  expect(css).toContain(".lobby:has(input:focus)");
  expect(css).toContain("overflow: visible;");
});
