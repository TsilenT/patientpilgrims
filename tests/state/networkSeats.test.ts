import { describe, expect, it } from "vitest";
import { seatForUidInSeats, seatClaimConflict } from "../../src/net/game";

describe("seatForUidInSeats", () => {
  const seats = {
    0: { uid: "alice" },
    1: { uid: "bob-phone", devices: { "bob-tablet": "token" } },
  };

  it("finds the device that originally joined the lobby", () => {
    expect(seatForUidInSeats(seats, "alice")).toBe(0);
  });

  it("finds another device added with the seat link", () => {
    expect(seatForUidInSeats(seats, "bob-tablet")).toBe(1);
  });

  it("returns spectator mode for an unclaimed device", () => {
    expect(seatForUidInSeats(seats, "carol")).toBe(-1);
  });
});

describe("seatClaimConflict", () => {
  it("allows a new browser or another device for the same seat", () => {
    expect(seatClaimConflict(-1, 1)).toBeNull();
    expect(seatClaimConflict(1, 1)).toBeNull();
  });

  it("rejects adding one browser to two different seats", () => {
    expect(seatClaimConflict(0, 1)).toMatch(/already controls seat 1/i);
  });
});