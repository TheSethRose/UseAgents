import { describe, it, expect } from "vitest";
import { hasGrantedPermissions } from "../src/utils/permissions.js";
import type { Manifest } from "../src/types.js";

function makeManifest(overrides: Partial<Manifest["permissions"] & { tools: string[] }> = {}): Manifest {
  return {
    name: "test-agent",
    version: "1.0.0",
    description: "test",
    runtime: { type: "javascript", entrypoint: "./index.js" },
    permissions: {
      network: overrides.network ?? false,
      filesystem: overrides.filesystem ?? { read: [], write: [] },
      secrets: overrides.secrets ?? [],
      sandbox: overrides.sandbox,
    },
    tools: overrides.tools ?? [],
  } as Manifest;
}

describe("hasGrantedPermissions", () => {
  it("returns false when no record exists", () => {
    const store = { agents: {} };
    const manifest = makeManifest();
    expect(hasGrantedPermissions(store, "test-agent", manifest)).toBe(false);
  });

  it("returns true when permissions match exactly", () => {
    const store = {
      agents: {
        "test-agent": {
          agentName: "test-agent",
          grantedAt: "2024-01-01T00:00:00Z",
          permissions: {
            network: false,
            filesystem: { read: [], write: [] },
            secrets: [],
            tools: [],
          },
        },
      },
    };
    const manifest = makeManifest();
    expect(hasGrantedPermissions(store, "test-agent", manifest)).toBe(true);
  });

  it("returns false when network permission differs", () => {
    const store = {
      agents: {
        "test-agent": {
          agentName: "test-agent",
          grantedAt: "2024-01-01T00:00:00Z",
          permissions: {
            network: false,
            filesystem: { read: [], write: [] },
            secrets: [],
            tools: [],
          },
        },
      },
    };
    const manifest = makeManifest({ network: true });
    expect(hasGrantedPermissions(store, "test-agent", manifest)).toBe(false);
  });

  it("returns false when filesystem read paths differ", () => {
    const store = {
      agents: {
        "test-agent": {
          agentName: "test-agent",
          grantedAt: "2024-01-01T00:00:00Z",
          permissions: {
            network: false,
            filesystem: { read: ["./data"], write: [] },
            secrets: [],
            tools: [],
          },
        },
      },
    };
    const manifest = makeManifest({ filesystem: { read: [], write: [] } });
    expect(hasGrantedPermissions(store, "test-agent", manifest)).toBe(false);
  });

  it("returns false when secrets differ", () => {
    const store = {
      agents: {
        "test-agent": {
          agentName: "test-agent",
          grantedAt: "2024-01-01T00:00:00Z",
          permissions: {
            network: false,
            filesystem: { read: [], write: [] },
            secrets: ["KEY_A"],
            tools: [],
          },
        },
      },
    };
    const manifest = makeManifest({ secrets: ["KEY_B"] });
    expect(hasGrantedPermissions(store, "test-agent", manifest)).toBe(false);
  });

  it("returns false when tools differ", () => {
    const store = {
      agents: {
        "test-agent": {
          agentName: "test-agent",
          grantedAt: "2024-01-01T00:00:00Z",
          permissions: {
            network: false,
            filesystem: { read: [], write: [] },
            secrets: [],
            tools: ["echo.text"],
          },
        },
      },
    };
    const manifest = makeManifest({ tools: ["http.fetch"] });
    expect(hasGrantedPermissions(store, "test-agent", manifest)).toBe(false);
  });

  it("handles network as object with enabled false", () => {
    const store = {
      agents: {
        "test-agent": {
          agentName: "test-agent",
          grantedAt: "2024-01-01T00:00:00Z",
          permissions: {
            network: false,
            filesystem: { read: [], write: [] },
            secrets: [],
            tools: [],
          },
        },
      },
    };
    const manifest = makeManifest({
      network: { enabled: false, domains: [] },
    });
    expect(hasGrantedPermissions(store, "test-agent", manifest)).toBe(true);
  });
});
