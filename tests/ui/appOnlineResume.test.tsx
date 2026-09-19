// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { App } from "../../src/app/App";
import { LAST_ONLINE_GAME_KEY } from "../../src/app/lastOnlineGame";

const online = vi.hoisted(() => ({
  getMeta: vi.fn(),
  makeLobbyBackend: vi.fn(() => ({ subscribe: () => () => {} })),
}));

vi.mock("../../src/net/firebase", () => ({ isFirebaseConfigured: () => true }));
vi.mock("../../src/net/game", () => ({
  makeRtdbBackend: vi.fn(),
  seatForUid: vi.fn(),
}));
vi.mock("../../src/net/lobby", () => ({
  createLobby: vi.fn(),
  getMeta: online.getMeta,
  makeLobbyBackend: online.makeLobbyBackend,
}));

beforeEach(() => {
  localStorage.clear();
  history.replaceState(null, "", "#/");
  online.getMeta.mockReset();
  online.makeLobbyBackend.mockClear();
});

test("the app offers the last online game remembered by this device", async () => {
  localStorage.setItem(LAST_ONLINE_GAME_KEY, "abc234");
  render(<App />);
  expect(await screen.findByRole("button", { name: /join last online game/i })).toBeInTheDocument();
});

test("loading a real online lobby remembers it for the next launch", async () => {
  online.getMeta.mockResolvedValue({
    createdAt: 1,
    host: "host-uid",
    status: "lobby",
    mode: "random",
  });
  history.replaceState(null, "", "#/g/abc234");
  render(<App />);
  await waitFor(() => expect(localStorage.getItem(LAST_ONLINE_GAME_KEY)).toBe("abc234"));
  expect(online.makeLobbyBackend).toHaveBeenCalledWith("abc234");
});