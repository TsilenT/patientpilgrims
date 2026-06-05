// @vitest-environment jsdom
import { test, expect } from "vitest";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GameProvider } from "../../src/state/GameProvider";
import { GameStore } from "../../src/state/gameStore";
import { GameView } from "../../src/ui/GameView";
import { createInitialGame, mulberry32 } from "../../src/engine";
import { createBoard } from "../../src/board";
import { LocalStoragePersistence } from "../../src/state/persistence";
import { legalTargets } from "../../src/state/legalTargets";

test("clicking a legal setup vertex dispatches setupSettlement", async () => {
  const g = createInitialGame(
    [{ name: "A", color: "red" }, { name: "B", color: "blue" }, { name: "C", color: "white" }],
    createBoard({ mode: "beginner" }),
  );
  const store = new GameStore(g, new LocalStoragePersistence(), mulberry32(1));
  const { container } = render(<GameProvider store={store}><GameView /></GameProvider>);
  const legalV = [...legalTargets(g).vertices][0]!;
  const slot = container.querySelector(`[data-vertex-slot="${legalV}"]`)!;
  await userEvent.click(slot);
  expect(store.getState().board.buildings[legalV]).toEqual({ owner: g.turn.activeSeat, type: "settlement" });
});
