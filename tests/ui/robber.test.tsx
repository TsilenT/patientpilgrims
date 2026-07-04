// @vitest-environment jsdom
import { test, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GameProvider } from "../../src/state/GameProvider";
import { GameStore } from "../../src/state/gameStore";
import { GameView } from "../../src/ui/GameView";
import { createInitialGame, mulberry32 } from "../../src/engine";
import { createBoard } from "../../src/board";
import { LocalStoragePersistence } from "../../src/state/persistence";
import { topology } from "../../src/engine/board";

test("moving robber phase shows an obvious robber placement prompt", () => {
  const g = createInitialGame(
    [{ name: "A", color: "red" }, { name: "B", color: "blue" }, { name: "C", color: "white" }],
    createBoard({ mode: "beginner" }),
  );
  g.phase = "main"; g.turn = { activeSeat: 0, subPhase: "movingRobber" }; delete g.setup;
  const s = new GameStore(g, new LocalStoragePersistence(), mulberry32(0));
  const { container } = render(<GameProvider store={s}><GameView /></GameProvider>);

  expect(screen.getByRole("status", { name: /robber placement/i }))
    .toHaveTextContent("Move the robber");
  expect(screen.getByRole("status", { name: /robber placement/i }))
    .not.toHaveTextContent(/roll 7/i);
  expect(container.querySelector(".board--robber-placement")).toBeTruthy();
});

test("clicking a robber hex with one victim waits for confirmation before stealing", async () => {
  const g = createInitialGame(
    [{ name: "A", color: "red" }, { name: "B", color: "blue" }, { name: "C", color: "white" }],
    createBoard({ mode: "beginner" }),
  );
  g.phase = "main"; g.turn = { activeSeat: 0, subPhase: "movingRobber" }; delete g.setup;
  const targetHex = topology().hexIds.find((h) => h !== g.board.robber)!;
  const vtx = topology().hexVertices.get(targetHex)![0]!;
  g.board.buildings[vtx] = { owner: 1, type: "settlement" };
  g.players[1]!.resources = { wood: 1, brick: 0, sheep: 0, wheat: 0, ore: 0 };
  const s = new GameStore(g, new LocalStoragePersistence(), mulberry32(0));
  const { container } = render(<GameProvider store={s}><GameView /></GameProvider>);
  await userEvent.click(container.querySelector(`[data-hex-slot="${targetHex}"]`)!);
  expect(s.getState().board.robber).not.toBe(targetHex);
  expect(container.querySelector(".board--robber-selected")).toBeTruthy();
  expect(container.querySelector(`[data-hex-slot="${targetHex}"]`)?.getAttribute("data-selected")).toBe("true");
  const otherHex = topology().hexIds.find((h) => h !== g.board.robber && h !== targetHex)!;
  expect(container.querySelector(`[data-hex-slot="${otherHex}"]`)?.getAttribute("data-selected")).toBeNull();
  const confirm = screen.getByRole("dialog", { name: /confirm robber placement/i });
  expect(confirm).toHaveClass("action-bar");
  const bottomSheet = container.querySelector(".bottom-sheet")!;
  expect(confirm.compareDocumentPosition(bottomSheet) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  await userEvent.click(within(confirm).getByRole("button", { name: /confirm/i }));
  expect(s.getState().board.robber).toBe(targetHex);
  expect(s.getState().turn.subPhase).toBe("main");
  expect(s.getState().players[0]!.resources.wood).toBe(1);
});

test("cancelling robber confirmation leaves the robber unmoved", async () => {
  const g = createInitialGame(
    [{ name: "A", color: "red" }, { name: "B", color: "blue" }, { name: "C", color: "white" }],
    createBoard({ mode: "beginner" }),
  );
  g.phase = "main"; g.turn = { activeSeat: 0, subPhase: "movingRobber" }; delete g.setup;
  const originalHex = g.board.robber;
  const targetHex = topology().hexIds.find((h) => h !== originalHex)!;
  const s = new GameStore(g, new LocalStoragePersistence(), mulberry32(0));
  const { container } = render(<GameProvider store={s}><GameView /></GameProvider>);

  await userEvent.click(container.querySelector(`[data-hex-slot="${targetHex}"]`)!);
  const confirm = screen.getByRole("dialog", { name: /confirm robber placement/i });
  await userEvent.click(within(confirm).getByRole("button", { name: /cancel/i }));

  expect(s.getState().board.robber).toBe(originalHex);
  expect(s.getState().turn.subPhase).toBe("movingRobber");
  expect(screen.queryByRole("dialog", { name: /confirm robber placement/i })).toBeNull();
  expect(container.querySelector(`[data-hex-slot="${targetHex}"]`)?.getAttribute("data-selected")).toBeNull();
});

test("clicking a robber hex with two victims opens a picker after confirming; choosing one steals from them", async () => {
  const g = createInitialGame(
    [{ name: "A", color: "red" }, { name: "B", color: "blue" }, { name: "C", color: "white" }],
    createBoard({ mode: "beginner" }),
  );
  g.phase = "main"; g.turn = { activeSeat: 0, subPhase: "movingRobber" }; delete g.setup;
  const targetHex = topology().hexIds.find((h) => h !== g.board.robber)!;
  const verts = topology().hexVertices.get(targetHex)!;
  g.board.buildings[verts[0]!] = { owner: 1, type: "settlement" };
  g.board.buildings[verts[2]!] = { owner: 2, type: "settlement" };
  g.players[1]!.resources = { wood: 1, brick: 0, sheep: 0, wheat: 0, ore: 0 };
  g.players[2]!.resources = { wood: 0, brick: 0, sheep: 0, wheat: 1, ore: 0 };
  const s = new GameStore(g, new LocalStoragePersistence(), mulberry32(0));
  const { container } = render(<GameProvider store={s}><GameView /></GameProvider>);
  await userEvent.click(container.querySelector(`[data-hex-slot="${targetHex}"]`)!);
  // robber not moved yet — confirmation is required before choosing a victim
  expect(s.getState().board.robber).not.toBe(targetHex);
  const confirm = screen.getByRole("dialog", { name: /confirm robber placement/i });
  expect(screen.queryByRole("dialog", { name: /choose who to rob/i })).toBeNull();
  await userEvent.click(within(confirm).getByRole("button", { name: /confirm/i }));
  const picker = screen.getByRole("dialog", { name: /choose who to rob/i });
  await userEvent.click(within(picker).getByRole("button", { name: "C" })); // seat 2
  expect(s.getState().board.robber).toBe(targetHex);
  expect(s.getState().turn.subPhase).toBe("main");
  expect(s.getState().players[0]!.resources.wheat).toBe(1); // stole C's wheat
});
