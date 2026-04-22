import { describe, expect, it } from "vitest";
import {
  getManualInstallSteps,
  isSupportedPlatform,
  normalizeInput,
  resolveBootstrapPlan,
} from "../examples/openclaw-bootstrap/dist/index.js";

describe("openclaw-bootstrap example helpers", () => {
  it("supports macOS and Linux only for automated install", () => {
    expect(isSupportedPlatform("darwin")).toBe(true);
    expect(isSupportedPlatform("linux")).toBe(true);
    expect(isSupportedPlatform("win32")).toBe(false);
  });

  it("normalizes non-object input into prompt mode", () => {
    expect(normalizeInput(undefined)).toEqual({
      action: "prompt",
      autoConfirm: false,
      runOnboarding: false,
    });
  });

  it("returns manual guidance for unsupported platforms", () => {
    const plan = resolveBootstrapPlan({
      platform: "win32",
      openclawInstalled: false,
      action: "prompt",
      interactive: true,
    });

    expect(plan.status).toBe("openclaw_missing_manual");
    expect(plan.canAutoInstall).toBe(false);
    expect(plan.nextSteps).toContain("https://docs.openclaw.ai/start/getting-started");
  });

  it("requests install when OpenClaw is missing and install was explicitly requested", () => {
    const plan = resolveBootstrapPlan({
      platform: "darwin",
      openclawInstalled: false,
      action: "install",
      interactive: false,
    });

    expect(plan.status).toBe("openclaw_missing_install_requested");
    expect(plan.shouldRunInstall).toBe(true);
    expect(plan.nextSteps[0]).toContain("curl -fsSL https://openclaw.ai/install.sh | bash");
  });

  it("returns onboarding guidance when OpenClaw is already installed", () => {
    const plan = resolveBootstrapPlan({
      platform: "darwin",
      openclawInstalled: true,
      action: "prompt",
      interactive: false,
    });

    expect(plan.status).toBe("openclaw_present");
    expect(plan.nextSteps).toContain("openclaw onboard --install-daemon");
  });

  it("includes the documented manual commands for supported platforms", () => {
    expect(getManualInstallSteps("linux")).toEqual([
      "Install OpenClaw:",
      "curl -fsSL https://openclaw.ai/install.sh | bash",
      "",
      "Then run onboarding:",
      "openclaw onboard --install-daemon",
      "",
      "Optional verification:",
      "openclaw gateway status",
      "openclaw dashboard",
    ]);
  });
});