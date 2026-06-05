import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Without Vitest globals, Testing Library's auto-cleanup is disabled. Unmount
// rendered trees between tests so DOM queries don't see stale renders.
afterEach(() => cleanup());
