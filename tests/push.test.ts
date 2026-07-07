import { describe, it, expect } from "vitest";
import { readVapidPublicKey } from "../src/net/config";

describe("readVapidPublicKey", () => {
  it("returns null when the env var is absent", () => {
    // No VITE_VAPID_PUBLIC_KEY is set in the test env.
    expect(readVapidPublicKey()).toBeNull();
  });
});
