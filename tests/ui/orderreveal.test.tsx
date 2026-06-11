// @vitest-environment jsdom
import { test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GameProvider } from "../../src/state/GameProvider";
import { GameStore } from "../../src/state/gameStore";
import { GameView } from "../../src/ui/GameView";
import { createInitialGame, mulberry32 } from "../../src/engine";
import { createBoard } from "../../src/board";
import { LocalStoragePersistence } from "../../src/state/persistence";

const players = [
  { name: "Alice", color: "red" },
  { name: "Bob", color: "blue" },
  { name: "Carol", color: "white" },
];

function renderGame(rng?: ReturnType<typeof mulberry32>) {
  const g = createInitialGame(players, createBoard({ mode: "beginner" }), rng);
  const store = new GameStore(g, new LocalStoragePersistence(), mulberry32(0));
  render(<GameProvider store={store}><GameView /></GameProvider>);
  return g;
}

test("reveals the opening roll-off and who goes first, then dismisses", async () => {
  const g = renderGame(mulberry32(7));
  const dialog = screen.getByRole("dialog", { name: /turn order/i });
  const first = g.players[g.setup!.order[0]!]!.name;
  expect(dialog).toHaveTextContent(`${first} goes first`);
  // every player's roll is shown
  for (const p of players) expect(dialog).toHaveTextContent(p.name);
  await userEvent.click(screen.getByRole("button", { name: /begin/i }));
  expect(screen.queryByRole("dialog", { name: /turn order/i })).toBeNull();
});

test("renders nothing for games without an opening roll-off", () => {
  renderGame();
  expect(screen.queryByRole("dialog", { name: /turn order/i })).toBeNull();
});
