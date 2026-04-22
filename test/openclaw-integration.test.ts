import { describe, expect, it } from "vitest";
import {
  detectOpenClawUpstreamState,
  isManagedOpenClaw,
  OPENCLAW_INSTALL_COMMAND,
  OPENCLAW_SUPPORTED_ACTIONS,
} from "../src/integrations/openclaw.js";

describe("openclaw managed integration", () => {
  it("recognizes openclaw as a managed integration", () => {
    expect(isManagedOpenClaw("openclaw")).toBe(true);
    expect(isManagedOpenClaw("hello-world")).toBe(false);
  });

  it("uses the official installer in no-onboard mode", () => {
    expect(OPENCLAW_INSTALL_COMMAND).toContain("https://openclaw.ai/install.sh");
    expect(OPENCLAW_INSTALL_COMMAND).toContain("--no-onboard");
  });

  it("supports explicit deterministic actions only", () => {
    expect(OPENCLAW_SUPPORTED_ACTIONS).toEqual([
      "status",
      "install",
      "update",
      "onboard",
      "dashboard",
      "uninstall",
    ]);
  });

  it("detects upstream state separately from wrapper state", () => {
    const upstream = detectOpenClawUpstreamState();
    expect(typeof upstream.installed).toBe("boolean");
    expect(upstream.installMethod).toBe("official-installer");
    expect(typeof upstream.lastCheckedAt).toBe("string");
  });
});