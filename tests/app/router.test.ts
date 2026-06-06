import { describe, it, expect } from "vitest";
import { parseRoute } from "../../src/app/router";

describe("parseRoute", () => {
  it("treats empty / root hash as the start screen", () => {
    expect(parseRoute("")).toEqual({ kind: "start" });
    expect(parseRoute("#/")).toEqual({ kind: "start" });
  });
  it("parses a game route", () => {
    expect(parseRoute("#/g/abc123")).toEqual({ kind: "game", id: "abc123" });
  });
  it("parses a claim route with seat + token", () => {
    expect(parseRoute("#/g/abc123/claim/2/tokenXYZ")).toEqual({
      kind: "claim", id: "abc123", seat: 2, token: "tokenXYZ",
    });
  });
  it("falls back to start on an unrecognized hash", () => {
    expect(parseRoute("#/nonsense")).toEqual({ kind: "start" });
  });
});
