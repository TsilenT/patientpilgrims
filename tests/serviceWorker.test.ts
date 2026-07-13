import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import vm from "node:vm";

interface WorkerHarness {
  click: (event: unknown) => void;
  clients: {
    matchAll: ReturnType<typeof vi.fn>;
    openWindow: ReturnType<typeof vi.fn>;
  };
}

function loadWorker(windowClients: unknown[] = []): WorkerHarness {
  const listeners = new Map<string, (event: unknown) => void>();
  const clients = {
    matchAll: vi.fn(async () => windowClients),
    openWindow: vi.fn(async () => undefined),
  };
  const self = {
    registration: {
      scope: "https://example.com/patientpilgrims/",
      showNotification: vi.fn(),
    },
    clients,
    addEventListener: (type: string, listener: (event: unknown) => void) => {
      listeners.set(type, listener);
    },
  };

  const source = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
  vm.runInNewContext(source, { self, URL });
  return { click: listeners.get("notificationclick")!, clients };
}

function clickEvent(url: string) {
  let completion: Promise<unknown> | undefined;
  return {
    event: {
      notification: { data: { url }, close: vi.fn() },
      waitUntil: (promise: Promise<unknown>) => { completion = promise; },
    },
    completion: () => completion!,
  };
}

describe("push notification click navigation", () => {
  it("resolves a hash-only game target against the app scope, not sw.js", async () => {
    const worker = loadWorker();
    const click = clickEvent("#/g/g1");

    worker.click(click.event);
    await click.completion();

    expect(worker.clients.openWindow).toHaveBeenCalledWith(
      "https://example.com/patientpilgrims/#/g/g1",
    );
  });

  it("navigates an existing app window to the notified game before focusing it", async () => {
    const appClient = {
      url: "https://example.com/patientpilgrims/assets/index-old.js",
      navigate: vi.fn(),
      focus: vi.fn(async () => undefined),
    };
    appClient.navigate.mockResolvedValue(appClient);
    const worker = loadWorker([appClient]);
    const click = clickEvent("#/g/g1");

    worker.click(click.event);
    await click.completion();

    expect(appClient.navigate).toHaveBeenCalledWith(
      "https://example.com/patientpilgrims/#/g/g1",
    );
    expect(appClient.focus).toHaveBeenCalled();
    expect(worker.clients.openWindow).not.toHaveBeenCalled();
  });
});
