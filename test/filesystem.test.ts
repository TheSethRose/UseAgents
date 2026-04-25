import { describe, it, expect, afterEach, vi } from "vitest";
import { mkdir, mkdtemp, readlink, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("active version filesystem links", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("replaces an existing active symlink when switching versions", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "useagents-home-"));
    try {
      vi.stubEnv("HOME", homeDir);
      vi.resetModules();

      const filesystem = await import("../src/utils/filesystem.js");
      await filesystem.ensureDirs();

      await mkdir(filesystem.getAgentRuntimeDir("test-agent", "1.0.0"), { recursive: true });
      await mkdir(filesystem.getAgentRuntimeDir("test-agent", "2.0.0"), { recursive: true });

      await filesystem.setActiveVersion("test-agent", "1.0.0");
      await filesystem.setActiveVersion("test-agent", "2.0.0");

      expect(await filesystem.getActiveVersion("test-agent")).toBe("2.0.0");
      expect(await readlink(filesystem.getAgentActivePath("test-agent"))).toBe(
        filesystem.getAgentRuntimeDir("test-agent", "2.0.0")
      );
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  it("surfaces malformed JSON state instead of treating it as missing", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "useagents-home-"));
    try {
      vi.stubEnv("HOME", homeDir);
      vi.resetModules();

      const filesystem = await import("../src/utils/filesystem.js");
      await filesystem.ensureDirs();
      await writeFile(filesystem.INSTALLS_FILE, "{not-json", "utf-8");

      await expect(filesystem.readJson(filesystem.INSTALLS_FILE)).rejects.toThrow();
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  it("writes private JSON files without group or world permissions", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "useagents-home-"));
    try {
      vi.stubEnv("HOME", homeDir);
      vi.resetModules();

      const filesystem = await import("../src/utils/filesystem.js");
      await filesystem.ensureDirs();
      await filesystem.writePrivateJson(filesystem.AUTH_FILE, { registryToken: "secret" });

      const mode = (await stat(filesystem.AUTH_FILE)).mode & 0o777;
      expect(mode).toBe(0o600);
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });
});
