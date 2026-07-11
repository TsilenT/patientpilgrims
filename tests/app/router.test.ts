import { describe, it, expect } from "vitest";
import { parseRoute, extractGameId } from "../../src/app/router";

describe("parseRoute", () => {
  it("treats empty / root hash as the start screen", () => {
    expect(parseRoute("")).toEqual({ kind: "start" });
    expect(parseRoute("#/")).toEqual({ kind: "start" });
  });
  it("parses the hotseat lobby route", () => {
    expect(parseRoute("#/hotseat")).toEqual({ kind: "hotseat" });
  });
  it("parses the join screen route", () => {
    expect(parseRoute("#/join")).toEqual({ kind: "join" });
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

describe("extractGameId", () => {
  it("accepts a raw game code, normalizing case and whitespace", () => {
    expect(extractGameId("abc234")).toBe("abc234");
    expect(extractGameId("  ABC234 ")).toBe("abc234");
  });
  it("pulls the id out of a pasted invite link", () => {
    expect(extractGameId("https://example.com/#/g/xyz789")).toBe("xyz789");
    expect(extractGameId("https://example.com/beta/#/g/xyz789/claim/2/tok")).toBe("xyz789");
  });
  it("rejects text that contains no plausible code", () => {
    expect(extractGameId("")).toBeNull();
    expect(extractGameId("hello there friend")).toBeNull();
    expect(extractGameId("ab")).toBeNull();
  });
});
