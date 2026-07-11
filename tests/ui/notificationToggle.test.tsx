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

import { NotificationToggle, SettingsPanel } from "../../src/ui/panels/SettingsPanel";
import { getPushState, enablePush } from "../../src/net/push";

beforeEach(() => { vi.clearAllMocks(); (getPushState as any).mockResolvedValue("off"); });

describe("NotificationToggle", () => {
  it("enables push when toggled on", async () => {
    render(<NotificationToggle />);
    const btn = await screen.findByRole("button", { name: /notify me when it's my turn/i });
    await userEvent.click(btn);
    await waitFor(() => expect(enablePush).toHaveBeenCalledWith("uid-1"));
    expect(btn).toHaveAttribute("aria-pressed", "true");
    expect(btn).toHaveTextContent(/turn notifications are on/i);
  });

  it("stays out of the way when notifications are unsupported", async () => {
    (getPushState as any).mockResolvedValue("unsupported");
    const { container } = render(<NotificationToggle />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});

describe("SettingsPanel", () => {
  it("organizes preferences and includes an expandable basic rulebook", async () => {
    render(<SettingsPanel gameId="abc123" links={null} />);

    expect(screen.getByRole("heading", { name: /game settings/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /notifications/i })).toBeInTheDocument();

    const rulebook = screen.getByRole("button", { name: /how to play/i });
    expect(rulebook).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(/first player to reach 10 victory points/i)).not.toBeInTheDocument();

    await userEvent.click(rulebook);
    expect(rulebook).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/first player to reach 10 victory points/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /on your turn/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /building costs/i })).toBeInTheDocument();
    expect(screen.getByText(/longest road/i)).toBeInTheDocument();
  });
});
