// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  LAST_ONLINE_GAME_KEY,
  loadLastOnlineGameId,
  rememberOnlineGame,
} from "../../src/app/lastOnlineGame";

beforeEach(() => localStorage.clear());

test("remembers and reloads a valid online game id", () => {
  rememberOnlineGame("abc234");
  expect(localStorage.getItem(LAST_ONLINE_GAME_KEY)).toBe("abc234");
  expect(loadLastOnlineGameId()).toBe("abc234");
});

test("ignores corrupt remembered game ids", () => {
  localStorage.setItem(LAST_ONLINE_GAME_KEY, "not a / game id");
  expect(loadLastOnlineGameId()).toBeNull();
});


afterEach(() => vi.restoreAllMocks());

test("an invalid game does not replace the previous valid game", () => {
  rememberOnlineGame("abc234");
  expect(rememberOnlineGame("invalid / id")).toBeNull();
  expect(loadLastOnlineGameId()).toBe("abc234");
});

test("storage read failures are non-fatal", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
  expect(loadLastOnlineGameId()).toBeNull();
});

test("storage write failures still return the valid game for this session", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
  expect(rememberOnlineGame("abc234")).toBe("abc234");
});
