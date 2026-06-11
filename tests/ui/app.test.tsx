// @vitest-environment jsdom
import { test, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../../src/app/App";
import { LocalStoragePersistence } from "../../src/state/persistence";
import { createInitialGame } from "../../src/engine";
import { createBoard } from "../../src/board";

beforeEach(() => localStorage.clear());

function savedGame() {
  return createInitialGame(
    [{ name: "A", color: "red" }, { name: "B", color: "blue" }, { name: "C", color: "white" }],
    createBoard({ mode: "beginner" }),
  );
}

test("with no save, the start screen creates a game and shows the board", async () => {
  render(<App />);
  await userEvent.click(await screen.findByRole("button", { name: /start hotseat game/i }));
  expect(await screen.findByRole("img", { name: /catan board/i })).toBeInTheDocument();
});

test("with a save, resume enters the saved game", async () => {
  await new LocalStoragePersistence().save(savedGame());
  render(<App />);
  await userEvent.click(await screen.findByRole("button", { name: /resume hotseat game/i }));
  expect(await screen.findByRole("img", { name: /catan board/i })).toBeInTheDocument();
});

test("with a save, delete saved game clears it and shows the start screen", async () => {
  await new LocalStoragePersistence().save(savedGame());
  render(<App />);
  await userEvent.click(await screen.findByRole("button", { name: /delete saved game/i }));
  expect(await screen.findByRole("button", { name: /start hotseat game/i })).toBeInTheDocument();
  expect(await new LocalStoragePersistence().load()).toBeNull();
});
