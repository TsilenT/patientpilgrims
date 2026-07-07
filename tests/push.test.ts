import { describe, it, expect } from "vitest";
import { readVapidPublicKey } from "../src/net/config";
import { urlBase64ToUint8Array, pushSupported } from "../src/net/push";

describe("readVapidPublicKey", () => {
  it("returns null when the env var is absent", () => {
    // No VITE_VAPID_PUBLIC_KEY is set in the test env.
    expect(readVapidPublicKey()).toBeNull();
  });
});

describe("urlBase64ToUint8Array", () => {
  it("decodes a base64url VAPID key to bytes", () => {
    // "BQ" (base64url) → single byte 0x05.
    const bytes = urlBase64ToUint8Array("BQ");
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes[0]).toBe(0x05);
  });

  it("handles missing padding and url-safe chars without throwing", () => {
    expect(() => urlBase64ToUint8Array("a-b_c")).not.toThrow();
  });
});

describe("pushSupported", () => {
  it("is false when Push APIs are absent (node/jsdom default)", () => {
    expect(pushSupported()).toBe(false);
  });
});
