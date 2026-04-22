import { describe, it, expect } from "vitest";
import { manifestSchema } from "../src/types.js";

describe("manifestSchema", () => {
  const validManifest = {
    name: "hello-world",
    version: "1.0.0",
    description: "A simple agent",
    runtime: {
      type: "javascript" as const,
      entrypoint: "./dist/index.js",
    },
    permissions: {
      network: false,
      filesystem: { read: [], write: [] },
      secrets: [],
    },
    tools: ["echo.text"],
  };

  it("accepts a valid minimal manifest", () => {
    const result = manifestSchema.safeParse(validManifest);
    expect(result.success).toBe(true);
  });

  it("accepts network as boolean false", () => {
    const result = manifestSchema.safeParse({
      ...validManifest,
      permissions: { ...validManifest.permissions, network: false },
    });
    expect(result.success).toBe(true);
  });

  it("accepts network as boolean true", () => {
    const result = manifestSchema.safeParse({
      ...validManifest,
      permissions: { ...validManifest.permissions, network: true },
    });
    expect(result.success).toBe(true);
  });

  it("accepts network with domain allowlist", () => {
    const result = manifestSchema.safeParse({
      ...validManifest,
      permissions: {
        ...validManifest.permissions,
        network: {
          enabled: true,
          domains: ["api.example.com", "*.openai.com"],
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts sandbox configuration", () => {
    const result = manifestSchema.safeParse({
      ...validManifest,
      permissions: {
        ...validManifest.permissions,
        sandbox: {
          enabled: true,
          tools: ["echo.text"],
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid name with spaces", () => {
    const result = manifestSchema.safeParse({
      ...validManifest,
      name: "hello world",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid version", () => {
    const result = manifestSchema.safeParse({
      ...validManifest,
      version: "1.0",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty description", () => {
    const result = manifestSchema.safeParse({
      ...validManifest,
      description: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid runtime type", () => {
    const result = manifestSchema.safeParse({
      ...validManifest,
      runtime: { type: "python", entrypoint: "./main.py" },
    });
    expect(result.success).toBe(false);
  });

  it("applies default values for optional fields", () => {
    const result = manifestSchema.safeParse({
      name: "minimal",
      version: "1.0.0",
      description: "test",
      runtime: { type: "javascript" as const, entrypoint: "./index.js" },
      permissions: {},
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.permissions.network).toBe(false);
      expect(result.data.permissions.filesystem.read).toEqual([]);
      expect(result.data.permissions.filesystem.write).toEqual([]);
      expect(result.data.permissions.secrets).toEqual([]);
      expect(result.data.tools).toEqual([]);
    }
  });
});
