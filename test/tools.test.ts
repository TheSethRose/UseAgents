import { describe, it, expect } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

describe("createToolRegistry filesystem permissions", () => {
  const basePerms: Manifest["permissions"] = {
    network: false,
    filesystem: { read: ["./data"], write: ["./data"] },
    secrets: [],
  };

  it("allows paths inside an allowed directory", async () => {
    const basePath = await mkdtemp(join(tmpdir(), "useagents-tools-"));
    try {
      await mkdir(join(basePath, "data"), { recursive: true });
      await writeFile(join(basePath, "data", "input.txt"), "hello", "utf-8");

      const registry = createToolRegistry(basePerms, ["fs.readText", "fs.writeText"], basePath);
      await expect(registry["fs.readText"]({ path: "./data/input.txt" })).resolves.toEqual({
        content: "hello",
      });

      await registry["fs.writeText"]({ path: "./data/output.txt", content: "written" });
      await expect(readFile(join(basePath, "data", "output.txt"), "utf-8")).resolves.toBe("written");
    } finally {
      await rm(basePath, { recursive: true, force: true });
    }
  });

  it("denies sibling paths that share the same prefix", async () => {
    const basePath = await mkdtemp(join(tmpdir(), "useagents-tools-"));
    try {
      await mkdir(join(basePath, "database"), { recursive: true });
      await writeFile(join(basePath, "database", "secret.txt"), "secret", "utf-8");

      const registry = createToolRegistry(basePerms, ["fs.readText", "fs.writeText"], basePath);
      await expect(registry["fs.readText"]({ path: "./database/secret.txt" })).rejects.toThrow(/Read access denied/);
      await expect(
        registry["fs.writeText"]({ path: "./database/output.txt", content: "blocked" })
      ).rejects.toThrow(/Write access denied/);
    } finally {
      await rm(basePath, { recursive: true, force: true });
    }
  });
});
