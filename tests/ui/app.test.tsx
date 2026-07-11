// @vitest-environment jsdom
import { test, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../../src/app/App";
import { LocalStoragePersistence } from "../../src/state/persistence";
import { createInitialGame } from "../../src/engine";
import { createBoard } from "../../src/board";

beforeEach(() => {
  localStorage.clear();
  history.replaceState(null, "", "#/");
});

function savedGame() {
  return createInitialGame(
    [{ name: "A", color: "red" }, { name: "B", color: "blue" }, { name: "C", color: "white" }],
    createBoard({ mode: "beginner" }),
  );
}

test("with no save, the home menu leads to the hotseat lobby which starts a game", async () => {
  render(<App />);
  await userEvent.click(await screen.findByRole("button", { name: /new hotseat game/i }));
  await userEvent.click(await screen.findByRole("button", { name: /start game/i }));
  expect(await screen.findByRole("img", { name: /game board/i })).toBeInTheDocument();
});

test("the home menu does not show hotseat player setup", async () => {
  render(<App />);
  await screen.findByRole("button", { name: /new hotseat game/i });
  expect(screen.queryByLabelText(/player count/i)).toBeNull();
  expect(screen.queryByLabelText(/player 1 name/i)).toBeNull();
});

test("with a save, the home menu offers resume and the hotseat lobby resumes it", async () => {
  await new LocalStoragePersistence().save(savedGame());
  render(<App />);
  await userEvent.click(await screen.findByRole("button", { name: /resume hotseat game/i }));
  await userEvent.click(await screen.findByRole("button", { name: /resume game/i }));
  expect(await screen.findByRole("img", { name: /game board/i })).toBeInTheDocument();
});

test("with a save, the hotseat lobby can delete it and still start a new game", async () => {
  await new LocalStoragePersistence().save(savedGame());
  render(<App />);
  await userEvent.click(await screen.findByRole("button", { name: /resume hotseat game/i }));
  await userEvent.click(await screen.findByRole("button", { name: /delete saved game/i }));
  expect(screen.queryByRole("button", { name: /resume game/i })).toBeNull();
  expect(await new LocalStoragePersistence().load()).toBeNull();
  expect(screen.getByRole("button", { name: /start game/i })).toBeInTheDocument();
});

test("the hotseat lobby has a way back to the menu", async () => {
  render(<App />);
  await userEvent.click(await screen.findByRole("button", { name: /new hotseat game/i }));
  await userEvent.click(await screen.findByRole("button", { name: /back to menu/i }));
  expect(await screen.findByRole("button", { name: /new hotseat game/i })).toBeInTheDocument();
});

test("home menu shows the Patient Pilgrims brand", async () => {
  render(<App />);
  expect(await screen.findByRole("heading", { name: "Patient Pilgrims" })).toBeInTheDocument();
});

test("the hotseat lobby defaults to a collapsed random board layout picker", async () => {
  render(<App />);
  await userEvent.click(await screen.findByRole("button", { name: /new hotseat game/i }));
  const trigger = await screen.findByRole("button", { name: /board layout: random/i });
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByText(/standard a–r token spiral/i)).toBeNull();
  await userEvent.click(trigger);
  expect(screen.getByText(/standard a–r token spiral/i)).toBeInTheDocument();
});
