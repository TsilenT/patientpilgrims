// @vitest-environment jsdom
import { beforeEach, expect, test } from "vitest";
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