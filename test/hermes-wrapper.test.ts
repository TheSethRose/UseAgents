import { afterEach, describe, expect, it, vi } from "vitest";

const execSyncMock = vi.fn();
const accessSyncMock = vi.fn();

vi.mock("node:child_process", () => ({
  execSync: execSyncMock,
}));

vi.mock("node:fs", () => ({
  accessSync: accessSyncMock,
}));

vi.mock("node:os", () => ({
  platform: () => "darwin",
}));

describe("Hermes managed integration wrapper", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("installs Hermes with setup skipped to avoid nested interactive chat", async () => {
    let installRan = false;

    accessSyncMock.mockImplementation(() => {
      throw new Error("not found");
    });

    execSyncMock.mockImplementation((cmd: string) => {
      if (cmd === "command -v hermes" || cmd === "which hermes") {
        if (!installRan) {
          throw new Error("missing hermes");
        }
        return "/Users/test/.local/bin/hermes\n";
      }

      if (cmd === "/Users/test/.local/bin/hermes --version") {
        return "Hermes Agent v0.11.0\n";
      }

      if (cmd.includes("install.sh")) {
        installRan = true;
        return "";
      }

      throw new Error(`Unexpected command: ${cmd}`);
    });

    // @ts-expect-error Runtime integration test intentionally imports the published JS wrapper artifact.
    const { integration } = await import("../../website/data/wrappers/hermes-1.0.1.js");
    const result = await integration.install({});

    expect(result.status).toBe("hermes_installed");
    expect(result.summary).toContain("Setup was skipped");
    expect(result.nextSteps).toContain("Run 'hermes setup' to configure Hermes.");

    const installCall = execSyncMock.mock.calls.find(([cmd]) => String(cmd).includes("install.sh"));
    expect(String(installCall?.[0])).toContain("bash -s -- --skip-setup");
    expect(installCall?.[1]).toMatchObject({ stdio: "inherit" });
  });

  it("uses the non-interactive installer fallback when hermes update fails", async () => {
    let fallbackInstallRan = false;

    accessSyncMock.mockImplementation(() => {
      throw new Error("not found");
    });

    execSyncMock.mockImplementation((cmd: string) => {
      if (cmd === "command -v hermes" || cmd === "which hermes") {
        return "/Users/test/.local/bin/hermes\n";
      }

      if (cmd === "/Users/test/.local/bin/hermes --version") {
        return fallbackInstallRan ? "Hermes Agent v0.11.1\n" : "Hermes Agent v0.11.0\n";
      }

      if (cmd === "hermes update") {
        throw new Error("update failed");
      }

      if (cmd.includes("install.sh")) {
        fallbackInstallRan = true;
        return "";
      }

      throw new Error(`Unexpected command: ${cmd}`);
    });

    // @ts-expect-error Runtime integration test intentionally imports the published JS wrapper artifact.
    const { integration } = await import("../../website/data/wrappers/hermes-1.0.1.js");
    const result = await integration.update({});

    expect(result.status).toBe("hermes_updated");
    expect(result.version).toContain("0.11.1");

    const installCall = execSyncMock.mock.calls.find(([cmd]) => String(cmd).includes("install.sh"));
    expect(String(installCall?.[0])).toContain("bash -s -- --skip-setup");
    expect(installCall?.[1]).toMatchObject({ stdio: "inherit" });
  });
});