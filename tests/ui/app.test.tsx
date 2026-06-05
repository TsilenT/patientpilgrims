// @vitest-environment jsdom
import { test, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../../src/app/App";

beforeEach(() => localStorage.clear());

test("start screen creates a game and shows the board", async () => {
  render(<App />);
  await userEvent.click(await screen.findByRole("button", { name: /start/i }));
  expect(await screen.findByRole("img", { name: /catan board/i })).toBeInTheDocument();
});
