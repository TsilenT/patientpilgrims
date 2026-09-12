// @vitest-environment jsdom
import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createBoard } from "../../src/board";
import { createInitialGame } from "../../src/engine";
import { RobberVictimPicker } from "../../src/ui/overlays/RobberVictimPicker";

test("shows each eligible player's color so identical names can be distinguished", async () => {
  const state = createInitialGame(
    [
      { name: "Alex", color: "red" },
      { name: "Alex", color: "blue" },
      { name: "Casey", color: "white" },
    ],
    createBoard({ mode: "beginner" }),
  );
  const onPick = vi.fn();

  render(<RobberVictimPicker state={state} victims={[0, 1]} onPick={onPick} />);

  const redAlex = screen.getByRole("button", { name: "Alex, red player" });
  const blueAlex = screen.getByRole("button", { name: "Alex, blue player" });
  expect(redAlex).toHaveTextContent("Alex");
  expect(redAlex).toHaveTextContent("Red");
  expect(redAlex.querySelector(".robber-victim-swatch")).toHaveStyle({ background: "red" });
  expect(blueAlex.querySelector(".robber-victim-swatch")).toHaveStyle({ background: "blue" });

  await userEvent.click(blueAlex);
  expect(onPick).toHaveBeenCalledWith(1);
});
