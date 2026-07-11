// @vitest-environment jsdom
import { test, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Lobby } from "../../src/app/Lobby";
import type { LobbyBackend, LobbyView } from "../../src/net/lobby";

function fakeBackend(initial: LobbyView) {
  let cb: ((v: LobbyView) => void) | null = null;
  let view = initial;
  const backend: LobbyBackend = {
    subscribe(c) { cb = c; c(view); return () => { cb = null; }; },
    claim: vi.fn(async () => {}),
    leave: vi.fn(async () => {}),
    kick: vi.fn(async () => {}),
    setMode: vi.fn(async () => {}),
    start: vi.fn(async () => {}),
  };
  const push = (v: LobbyView) => { view = v; act(() => cb?.(v)); };
  return { backend, push };
}

const meta = (over: object = {}) =>
  ({ createdAt: 1, host: "host-uid", status: "lobby" as const, mode: "beginner" as const, ...over });

test("a visitor joins with their own name and color", async () => {
  const { backend } = fakeBackend({ meta: meta(), roster: {}, myUid: "me" });
  render(<Lobby id="abc123" backend={backend} onEnterGame={() => {}} />);

  expect(screen.getByText(/game code/i)).toHaveTextContent("abc123");
  expect(screen.getAllByText(/open seat/i)).toHaveLength(4);

  await userEvent.type(screen.getByLabelText(/your name/i), "Maya");
  await userEvent.click(screen.getByRole("radio", { name: "blue" }));
  await userEvent.click(screen.getByRole("button", { name: /join game/i }));
  expect(backend.claim).toHaveBeenCalledWith(0, "Maya", "blue");
});

test("roster updates live, marks you and the host crown", () => {
  const { backend, push } = fakeBackend({ meta: meta(), roster: {}, myUid: "me" });
  render(<Lobby id="abc123" backend={backend} onEnterGame={() => {}} />);
  push({
    meta: meta(),
    roster: {
      0: { uid: "host-uid", name: "Steve", color: "red" },
      1: { uid: "me", name: "Maya", color: "blue" },
    },
    myUid: "me",
  });
  expect(screen.getByText("Steve")).toBeInTheDocument();
  expect(screen.getByLabelText(/host/i)).toBeInTheDocument();
  expect(screen.getByText(/\(you\)/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /leave/i })).toBeInTheDocument();
});

test("host sees kick buttons on others and start gating at 3 players", async () => {
  const twoJoined = {
    meta: meta(),
    roster: {
      0: { uid: "host-uid", name: "Steve", color: "red" },
      1: { uid: "p2", name: "Maya", color: "blue" },
    },
    myUid: "host-uid",
  };
  const { backend, push } = fakeBackend(twoJoined);
  render(<Lobby id="abc123" backend={backend} onEnterGame={() => {}} />);

  expect(screen.getByRole("button", { name: /remove maya/i })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /remove steve/i })).toBeNull();
  expect(screen.getByRole("button", { name: /start game/i })).toBeDisabled();

  push({
    ...twoJoined,
    roster: { ...twoJoined.roster, 2: { uid: "p3", name: "Theo", color: "white" } },
  });
  const start = screen.getByRole("button", { name: /start game/i });
  expect(start).toBeEnabled();
  await userEvent.click(start);
  expect(backend.start).toHaveBeenCalled();
});

test("a non-host can start and manage the lobby", async () => {
  const { backend } = fakeBackend({
    meta: meta(),
    roster: {
      0: { uid: "host-uid", name: "Steve", color: "red" },
      1: { uid: "me", name: "Maya", color: "blue" },
      2: { uid: "p3", name: "Theo", color: "white" },
    },
    myUid: "me",
  });
  render(<Lobby id="abc123" backend={backend} onEnterGame={() => {}} />);
  expect(screen.queryByText(/waiting for the host/i)).toBeNull();
  expect(screen.getByRole("button", { name: /remove steve/i })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /board layout: beginner/i }));
  await userEvent.click(screen.getByRole("button", { name: /^random/i }));
  expect(backend.setMode).toHaveBeenCalledWith("random");
  const start = screen.getByRole("button", { name: /start game/i });
  expect(start).toBeEnabled();
  await userEvent.click(start);
  expect(backend.start).toHaveBeenCalled();
});

test("board layout opens explanations and collapses after choosing", async () => {
  const { backend } = fakeBackend({ meta: meta(), roster: {}, myUid: "me" });
  render(<Lobby id="abc123" backend={backend} onEnterGame={() => {}} />);

  const trigger = screen.getByRole("button", { name: /board layout: beginner/i });
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByText(/standard a–r token spiral/i)).toBeNull();

  await userEvent.click(trigger);
  expect(trigger).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByText(/standard a–r token spiral/i)).toBeInTheDocument();
  expect(screen.getByText(/numbers are shuffled freely/i)).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: /^alphabetical/i }));
  expect(backend.setMode).toHaveBeenCalledWith("alphabetical");
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByText(/standard a–r token spiral/i)).toBeNull();
});

test("status flipping to active enters the game", () => {
  const onEnter = vi.fn();
  const { backend, push } = fakeBackend({ meta: meta(), roster: {}, myUid: "me" });
  render(<Lobby id="abc123" backend={backend} onEnterGame={onEnter} />);
  push({ meta: meta({ status: "active" }), roster: {}, myUid: "me" });
  expect(onEnter).toHaveBeenCalledWith("abc123");
});

test("unknown game shows not-found", () => {
  const { backend } = fakeBackend({ meta: null, roster: {}, myUid: "me" });
  render(<Lobby id="zzz" backend={backend} onEnterGame={() => {}} />);
  expect(screen.getByText(/game not found/i)).toBeInTheDocument();
});
