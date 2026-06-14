// @vitest-environment jsdom
import { test, expect, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GameProvider } from "../../src/state/GameProvider";
import { GameView } from "../../src/ui/GameView";
import { createInitialGame, mulberry32, apply } from "../../src/engine";
import { createBoard } from "../../src/board";
import type { GameState } from "../../src/engine/types";
import type { Store, DispatchResult } from "../../src/state/store";

function mainGame(): GameState {
  const g = createInitialGame(
    [{ name: "Alice", color: "red" }, { name: "Bob", color: "blue" }, { name: "Carol", color: "white" }],
    createBoard({ mode: "beginner" }),
  );
  g.phase = "main"; g.turn = { activeSeat: 0, subPhase: "awaitingRoll" }; delete g.setup;
  return g;
}

function onlineStore(initial: GameState, mySeat: number): Store {
  let s = initial;
  const ls = new Set<() => void>();
  return {
    getState: () => s,
    subscribe: (cb) => { ls.add(cb); return () => { ls.delete(cb); }; },
    dispatch: (a): DispatchResult => {
      const r = apply(s, a, mulberry32(0));
      if (!r.ok) return { ok: false, error: r.error };
      s = r.state; ls.forEach((l) => l()); return { ok: true };
    },
    seat: () => mySeat,
  };
}

afterEach(() => {
  localStorage.clear();
  location.hash = "";
});

test("the hosting device gets a Links tab with per-seat rescue links", async () => {
  location.hash = "#/g/abc123";
  localStorage.setItem("adultingcatan:claims:abc123", JSON.stringify([
    { seat: 0, url: "https://x/#/g/abc123/claim/0/t0" },
    { seat: 1, url: "https://x/#/g/abc123/claim/1/t1" },
    { seat: 2, url: "https://x/#/g/abc123/claim/2/t2" },
  ]));
  render(<GameProvider store={onlineStore(mainGame(), 0)}><GameView /></GameProvider>);
  await userEvent.click(screen.getByRole("tab", { name: /links/i }));
  const panel = screen.getByLabelText("Game links");
  expect(panel).toHaveTextContent("Alice");
  expect(panel).toHaveTextContent("Bob");
  expect(panel).toHaveTextContent("Carol");
  expect(screen.getAllByRole("button", { name: /rescue link/i }).length).toBe(3);
});

test("non-hosting devices can open recovery links", async () => {
  location.hash = "#/g/abc123";
  localStorage.setItem("adultingcatan:claims:abc123", JSON.stringify([
    { seat: 0, url: "https://x/#/g/abc123/claim/0/t0" },
    { seat: 1, url: "https://x/#/g/abc123/claim/1/t1" },
    { seat: 2, url: "https://x/#/g/abc123/claim/2/t2" },
  ]));
  render(<GameProvider store={onlineStore(mainGame(), 1)}><GameView /></GameProvider>);
  await userEvent.click(screen.getByRole("tab", { name: /links/i }));
  const panel = screen.getByLabelText("Game links");
  expect(panel).toHaveTextContent("Alice");
  expect(panel).toHaveTextContent("Bob");
  expect(panel).toHaveTextContent("Carol");
});
