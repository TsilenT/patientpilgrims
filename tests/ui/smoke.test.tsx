// @vitest-environment jsdom
import { test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { App } from "../../src/app/App";

test("app shell renders", () => {
  render(<App />);
  expect(screen.getByTestId("app-root")).toBeInTheDocument();
});
