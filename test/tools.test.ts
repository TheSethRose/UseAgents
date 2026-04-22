import { describe, it, expect } from "vitest";
import { matchDomain, isNetworkAllowed, createToolRegistry } from "../src/adapters/tools.js";
import type { Manifest } from "../src/types.js";

describe("matchDomain", () => {
  it("matches exact domain", () => {
    expect(matchDomain("api.example.com", "api.example.com")).toBe(true);
  });

  it("rejects non-matching domain", () => {
    expect(matchDomain("api.example.com", "other.example.com")).toBe(false);
  });

  it("matches wildcard for subdomains", () => {
    expect(matchDomain("v1.api.example.com", "*.api.example.com")).toBe(true);
  });

  it("matches wildcard for direct subdomain", () => {
    expect(matchDomain("api.example.com", "*.example.com")).toBe(true);
  });

  it("matches wildcard when domain is the suffix itself", () => {
    expect(matchDomain("example.com", "*.example.com")).toBe(true);
  });

  it("matches global wildcard", () => {
    expect(matchDomain("anything.com", "*")).toBe(true);
  });
});

describe("isNetworkAllowed", () => {
  it("allows when network is true", () => {
    expect(isNetworkAllowed(true, "https://example.com")).toBe(true);
  });

  it("denies when network is false", () => {
    expect(isNetworkAllowed(false, "https://example.com")).toBe(false);
  });

  it("allows when domains list is empty and enabled", () => {
    expect(isNetworkAllowed({ enabled: true, domains: [] }, "https://example.com")).toBe(true);
  });

  it("denies when enabled is false", () => {
    expect(isNetworkAllowed({ enabled: false, domains: [] }, "https://example.com")).toBe(false);
  });

  it("allows matching domain", () => {
    expect(
      isNetworkAllowed({ enabled: true, domains: ["api.example.com"] }, "https://api.example.com/data")
    ).toBe(true);
  });

  it("rejects non-matching domain", () => {
    expect(
      isNetworkAllowed({ enabled: true, domains: ["api.example.com"] }, "https://other.com")
    ).toBe(false);
  });

  it("allows wildcard domain match", () => {
    expect(
      isNetworkAllowed({ enabled: true, domains: ["*.example.com"] }, "https://v1.example.com")
    ).toBe(true);
  });
});

describe("createToolRegistry sandbox", () => {
  const basePerms: Manifest["permissions"] = {
    network: false,
    filesystem: { read: [], write: [] },
    secrets: [],
  };

  it("creates working tools without sandbox", () => {
    const registry = createToolRegistry(basePerms, ["echo.text"], "/tmp/agent", false);
    expect(typeof registry["echo.text"]).toBe("function");
  });

  it("blocks non-allowed tools in sandbox mode", async () => {
    const perms: Manifest["permissions"] = {
      ...basePerms,
      sandbox: {
        enabled: true,
        tools: ["echo.text"],
      },
    };
    const registry = createToolRegistry(perms, ["echo.text", "http.fetch"], "/tmp/agent", true);

    expect(await registry["echo.text"]({ text: "hi" })).toEqual({ text: "hi" });
    await expect(registry["http.fetch"]({ url: "https://example.com" })).rejects.toThrow(/not allowed in sandbox/);
  });

  it("allows all tools when sandbox is not configured", () => {
    const registry = createToolRegistry(basePerms, ["echo.text", "http.fetch"], "/tmp/agent", true);
    expect(typeof registry["echo.text"]).toBe("function");
    expect(typeof registry["http.fetch"]).toBe("function");
  });

  it("throws for unknown tools", () => {
    expect(() => createToolRegistry(basePerms, ["unknown.tool"], "/tmp/agent")).toThrow(/Unknown tool/);
  });
});
