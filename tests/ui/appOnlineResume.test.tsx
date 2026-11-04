// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createInitialGame } from "../../src/engine";
import { createBoard } from "../../src/board";
import { App } from "../../src/app/App";
import { LAST_ONLINE_GAME_KEY } from "../../src/app/lastOnlineGame";

const online = vi.hoisted(() => ({
  getMeta: vi.fn(),
  seatForUid: vi.fn(),
  makeRtdbBackend: vi.fn(),
  makeLobbyBackend: vi.fn(() => ({ subscribe: () => () => {} })),
}));

vi.mock("../../src/net/firebase", () => ({ isFirebaseConfigured: () => true }));
vi.mock("../../src/net/game", () => ({
  makeRtdbBackend: online.makeRtdbBackend,
  seatForUid: online.seatForUid,
}));
vi.mock("../../src/net/lobby", () => ({
  createLobby: vi.fn(),
  hostRescueLinks: vi.fn(() => null),
  loadRescueLinks: vi.fn(async () => null),
  getMeta: online.getMeta,
  makeLobbyBackend: online.makeLobbyBackend,
}));

beforeEach(() => {
  localStorage.clear();
  history.replaceState(null, "", "#/");
  online.getMeta.mockReset();
  online.seatForUid.mockReset();
  online.makeRtdbBackend.mockReset();
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


test("a failed active-game join preserves the last working shortcut", async () => {
  localStorage.setItem(LAST_ONLINE_GAME_KEY, "old234");
  online.getMeta.mockResolvedValue({ status: "playing" });
  online.seatForUid.mockRejectedValue(new Error("Could not connect"));
  history.replaceState(null, "", "#/g/new234");
  render(<App />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not connect");
  expect(localStorage.getItem(LAST_ONLINE_GAME_KEY)).toBe("old234");
  await userEvent.click(screen.getByRole("button", { name: /back to start/i }));
  await userEvent.click(await screen.findByRole("button", { name: /join last online game/i }));
  expect(location.hash).toBe("#/g/old234");
});

test("a missing active-game state preserves the last working shortcut", async () => {
  localStorage.setItem(LAST_ONLINE_GAME_KEY, "old234");
  online.getMeta.mockResolvedValue({ status: "playing" });
  online.seatForUid.mockResolvedValue(0);
  online.makeRtdbBackend.mockReturnValue({ subscribe: (cb: (state: null) => void) => { cb(null); return () => {}; } });
  history.replaceState(null, "", "#/g/new234");
  render(<App />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Game not found.");
  expect(localStorage.getItem(LAST_ONLINE_GAME_KEY)).toBe("old234");
});

test("a successfully loaded active game becomes the next shortcut", async () => {
  localStorage.setItem(LAST_ONLINE_GAME_KEY, "old234");
  const state = createInitialGame(
    [{ name: "A", color: "red" }, { name: "B", color: "blue" }, { name: "C", color: "white" }],
    createBoard({ mode: "beginner" }),
  );
  online.getMeta.mockResolvedValue({ status: "playing" });
  online.seatForUid.mockResolvedValue(0);
  online.makeRtdbBackend.mockReturnValue({ subscribe: (cb: (value: typeof state) => void) => { cb(state); return () => {}; } });
  history.replaceState(null, "", "#/g/new234");
  render(<App />);
  expect(await screen.findByRole("img", { name: /game board/i })).toBeInTheDocument();
  expect(localStorage.getItem(LAST_ONLINE_GAME_KEY)).toBe("new234");
});

test("a nonexistent lobby does not replace the last working shortcut", async () => {
  localStorage.setItem(LAST_ONLINE_GAME_KEY, "old234");
  online.getMeta.mockResolvedValue(null);
  history.replaceState(null, "", "#/g/new234");
  render(<App />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Game not found.");
  expect(localStorage.getItem(LAST_ONLINE_GAME_KEY)).toBe("old234");
});
