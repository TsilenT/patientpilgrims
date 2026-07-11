// @vitest-environment jsdom
import { test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StartScreen } from "../../src/app/StartScreen";

beforeEach(() => history.replaceState(null, "", "#/"));

test("online options come first, hotseat last", async () => {
  render(<StartScreen hasSave={false} onCreateOnline={() => {}} />);
  const labels = screen.getAllByRole("button").map((b) => b.textContent);
  expect(labels).toEqual(["New online game", "Join online game", "New hotseat game"]);
});

test("without firebase, only the hotseat option shows", () => {
  render(<StartScreen hasSave={false} onCreateOnline={undefined} />);
  expect(screen.queryByRole("button", { name: /online/i })).toBeNull();
  expect(screen.getByRole("button", { name: /new hotseat game/i })).toBeInTheDocument();
});

test("new online game invokes the callback", async () => {
  const onCreateOnline = vi.fn();
  render(<StartScreen hasSave={false} onCreateOnline={onCreateOnline} />);
  await userEvent.click(screen.getByRole("button", { name: /new online game/i }));
  expect(onCreateOnline).toHaveBeenCalled();
});

test("join online game accepts a pasted invite link and navigates to it", async () => {
  render(<StartScreen hasSave={false} onCreateOnline={() => {}} />);
  await userEvent.click(screen.getByRole("button", { name: /join online game/i }));
  await userEvent.type(screen.getByLabelText(/game code/i), "https://example.com/#/g/abc234");
  await userEvent.click(screen.getByRole("button", { name: /^join$/i }));
  expect(location.hash).toBe("#/g/abc234");
});

test("join button stays disabled until the code looks valid", async () => {
  render(<StartScreen hasSave={false} onCreateOnline={() => {}} />);
  await userEvent.click(screen.getByRole("button", { name: /join online game/i }));
  const join = screen.getByRole("button", { name: /^join$/i });
  expect(join).toBeDisabled();
  await userEvent.type(screen.getByLabelText(/game code/i), "abc234");
  expect(join).toBeEnabled();
});

test("with a save, the hotseat button reads resume and points at the hotseat lobby", async () => {
  render(<StartScreen hasSave={true} onCreateOnline={undefined} />);
  await userEvent.click(screen.getByRole("button", { name: /resume hotseat game/i }));
  expect(location.hash).toBe("#/hotseat");
});
