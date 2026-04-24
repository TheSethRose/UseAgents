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

  it("list does not display versions for managed integrations", async () => {
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
      await filesystem.writeJson(filesystem.INTEGRATIONS_FILE, {
        integrations: {
          "claude-code": {
            name: "claude-code",
            kind: "managed-external",
            wrapperVersion: "1.0.0",
            upstream: {
              installed: true,
              version: "2.1.118",
              binaryPath: "/Users/test/.local/bin/claude",
              installMethod: "native-installer",
            },
          },
        },
      });

      await listCommand();

      const output = logs.join("\n");
      expect(output).toContain("Managed integrations");
      expect(output).toContain("claude-code");
      expect(output).not.toContain("Version");
      expect(output).not.toContain("2.1.118");
      expect(output).not.toContain("1.0.0");
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  it("search filters by managed integration type and hides wrapper versions", async () => {
    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((message = "") => {
      logs.push(String(message));
    });
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      expect(url).toContain("type=integration");
      expect(url).toContain("page=2");
      expect(url).toContain("limit=1");
      return {
        ok: true,
        json: async () => ({
          results: [
            {
              name: "claude-code",
              type: "managed-integration",
              latestVersion: "1.0.0",
              description: "Agentic coding tool",
              author: "thesethrose",
            },
          ],
          total: 3,
          page: 2,
          limit: 1,
          totalPages: 3,
        }),
      };
    }));

    const { searchCommand } = await import("../src/commands/search.js");
    await searchCommand("", { type: "integration", page: "2", limit: "1" });

    const output = logs.join("\n");
    expect(output).toContain("Registry managed integrations");
    expect(output).toContain("claude-code");
    expect(output).toContain("managed integration");
    expect(output).toContain("Next: agent search --type integration --page 3 --limit 1");
    expect(output).toContain("Prev: agent search --type integration --page 1 --limit 1");
    expect(output).not.toContain("1.0.0");
    expect(output).not.toContain("Version");
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
