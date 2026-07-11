// @vitest-environment jsdom
import { test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StartScreen } from "../../src/app/StartScreen";
import { JoinScreen } from "../../src/app/JoinScreen";

beforeEach(() => history.replaceState(null, "", "#/"));

test("online options come first, hotseat last", async () => {
  render(<StartScreen onCreateOnline={() => {}} />);
  const labels = screen.getAllByRole("button").map((b) => b.textContent);
  expect(labels).toEqual(["New online game", "Join online game", "Hotseat game"]);
});

test("without firebase, only the hotseat option shows", () => {
  render(<StartScreen onCreateOnline={undefined} />);
  expect(screen.queryByRole("button", { name: /online/i })).toBeNull();
  expect(screen.getByRole("button", { name: /hotseat game/i })).toBeInTheDocument();
});

test("new online game invokes the callback", async () => {
  const onCreateOnline = vi.fn();
  render(<StartScreen onCreateOnline={onCreateOnline} />);
  await userEvent.click(screen.getByRole("button", { name: /new online game/i }));
  expect(onCreateOnline).toHaveBeenCalled();
});

test("join online game leads to its own screen", async () => {
  render(<StartScreen onCreateOnline={() => {}} />);
  await userEvent.click(screen.getByRole("button", { name: /join online game/i }));
  expect(location.hash).toBe("#/join");
});

test("the hotseat button points at the hotseat lobby", async () => {
  render(<StartScreen onCreateOnline={undefined} />);
  await userEvent.click(screen.getByRole("button", { name: /hotseat game/i }));
  expect(location.hash).toBe("#/hotseat");
});

test("the join screen accepts a pasted invite link and navigates to it", async () => {
  render(<JoinScreen />);
  await userEvent.type(screen.getByLabelText(/game code/i), "https://example.com/#/g/abc234");
  await userEvent.click(screen.getByRole("button", { name: /^join$/i }));
  expect(location.hash).toBe("#/g/abc234");
});

test("the join button stays disabled until the code looks valid", async () => {
  render(<JoinScreen />);
  const join = screen.getByRole("button", { name: /^join$/i });
  expect(join).toBeDisabled();
  await userEvent.type(screen.getByLabelText(/game code/i), "abc234");
  expect(join).toBeEnabled();
});

test("the join screen has a way back to the menu", async () => {
  history.replaceState(null, "", "#/join");
  render(<JoinScreen />);
  await userEvent.click(screen.getByRole("button", { name: /back to menu/i }));
  expect(location.hash).toBe("#/");
});
