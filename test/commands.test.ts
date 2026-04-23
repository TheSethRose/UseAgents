import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("installed agent commands", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("list ignores dotfiles and broken active symlinks", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "useagents-home-"));
    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((message = "") => {
      logs.push(String(message));
    });

    try {
      vi.stubEnv("HOME", homeDir);
      vi.resetModules();

      const filesystem = await import("../src/utils/filesystem.js");
      const { listCommand } = await import("../src/commands/list.js");
      await filesystem.ensureDirs();

      const runtimeDir = filesystem.getAgentRuntimeDir("hermes", "1.0.0");
      await mkdir(runtimeDir, { recursive: true });
      await symlink(runtimeDir, filesystem.getAgentActivePath("hermes"), "junction");
      await symlink(
        filesystem.getAgentRuntimeDir("hello-world", "1.0.0"),
        filesystem.getAgentActivePath("hello-world"),
        "junction"
      );
      await writeFile(join(filesystem.ACTIVE_DIR, ".DS_Store"), "", "utf-8");

      await listCommand();

      const output = logs.join("\n");
      expect(output).toContain("hermes");
      expect(output).not.toContain("hello-world");
      expect(output).not.toContain(".DS_Store");
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  it("uninstall removes a local install before treating the name as a managed integration", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "useagents-home-"));
    vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      vi.stubEnv("HOME", homeDir);
      vi.resetModules();

      const filesystem = await import("../src/utils/filesystem.js");
      const { uninstallCommand } = await import("../src/commands/uninstall.js");
      await filesystem.ensureDirs();

      const runtimeDir = filesystem.getAgentRuntimeDir("hermes", "1.0.0");
      await mkdir(runtimeDir, { recursive: true });
      await symlink(runtimeDir, filesystem.getAgentActivePath("hermes"), "junction");
      await filesystem.writeJson(filesystem.INSTALLS_FILE, [
        {
          name: "hermes",
          version: "1.0.0",
          source: "/tmp/hermes",
          installedAt: "2026-04-23T00:00:00.000Z",
          active: true,
        },
      ]);

      await uninstallCommand("hermes");

      expect(await filesystem.pathExists(runtimeDir)).toBe(false);
      expect(await filesystem.pathExists(filesystem.getAgentActivePath("hermes"))).toBe(false);
      expect(await filesystem.readJson(filesystem.INSTALLS_FILE)).toEqual([]);
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });
});
