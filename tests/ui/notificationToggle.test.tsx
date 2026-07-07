// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../../src/net/push", () => ({
  getPushState: vi.fn(async () => "off"),
  enablePush: vi.fn(async () => "on"),
  disablePush: vi.fn(async () => {}),
}));
vi.mock("../../src/net/firebase", () => ({ ensureSignedIn: vi.fn(async () => "uid-1") }));

import { NotificationToggle } from "../../src/ui/panels/SettingsPanel";
import { getPushState, enablePush } from "../../src/net/push";

beforeEach(() => { vi.clearAllMocks(); (getPushState as any).mockResolvedValue("off"); });

describe("NotificationToggle", () => {
  it("enables push when toggled on", async () => {
    render(<NotificationToggle />);
    const btn = await screen.findByRole("button", { name: /notify me when it's my turn/i });
    await userEvent.click(btn);
    await waitFor(() => expect(enablePush).toHaveBeenCalledWith("uid-1"));
  });

  it("shows the install hint when unsupported", async () => {
    (getPushState as any).mockResolvedValue("unsupported");
    render(<NotificationToggle />);
    expect(await screen.findByText(/add to home screen/i)).toBeInTheDocument();
  });
});
