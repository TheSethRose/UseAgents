import { describe, expect, it } from "vitest";
import packageJson from "../package.json";
import { assertSafeCliInvocation, DEFAULT_USEAGENTS_BIN_NAME, getInvokedCliName } from "../src/utils/cli.js";

const allowedBinNames = Object.keys(packageJson.bin ?? {});

describe("CLI binary contract", () => {
  it("exposes only the agent binary in package.json", () => {
    expect(packageJson.bin).toEqual({
      [DEFAULT_USEAGENTS_BIN_NAME]: "dist/index.js",
    });
  });

  it("detects the invoked CLI basename", () => {
    expect(getInvokedCliName("/opt/homebrew/bin/agent")).toBe("agent");
    expect(getInvokedCliName("/opt/homebrew/bin/openclaw")).toBe("openclaw");
    expect(getInvokedCliName(undefined)).toBeNull();
  });

  it("rejects invocation through any undeclared binary name", () => {
    expect(() => assertSafeCliInvocation("/opt/homebrew/bin/openclaw", allowedBinNames)).toThrow(/declared CLI binaries/i);
    expect(() => assertSafeCliInvocation("/opt/homebrew/bin/another-name", allowedBinNames)).toThrow(/declared CLI binaries/i);
  });

  it("allows invocation through the agent binary and direct node entrypoints", () => {
    expect(() => assertSafeCliInvocation("/opt/homebrew/bin/agent", allowedBinNames)).not.toThrow();
    expect(() => assertSafeCliInvocation("/Users/sethrose/Developer/UseAgents/dist/index.js", allowedBinNames)).not.toThrow();
  });
});