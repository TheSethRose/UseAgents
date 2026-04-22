import { readJson, INSTALLS_FILE } from "../utils/filesystem.js";
import { UseAgentsError } from "../utils/errors.js";
import { installCommand } from "./install.js";
import { resolveInRegistry, isManagedIntegration } from "../registry.js";
import { loadManagedIntegration, upsertIntegrationRecord, formatIntegrationResult } from "../utils/integrations.js";
import type { InstallRecord } from "../types.js";

export async function upgradeCommand(agentName?: string): Promise<void> {
  const installs = await readJson<InstallRecord[]>(INSTALLS_FILE) || [];

  const targets = agentName
    ? installs.filter((i) => i.name === agentName)
    : installs;

  if (targets.length === 0 && !agentName) {
    console.log("No installed agents to upgrade.");
    return;
  }

  if (agentName && targets.length === 0) {
    if (isManagedIntegration(agentName)) {
      const entry = resolveInRegistry(agentName)!;
      const integration = await loadManagedIntegration(entry.path);
      const result = await integration.update({});
      await upsertIntegrationRecord({
        name: integration.name,
        kind: "managed-external",
        wrapperVersion: integration.wrapperVersion,
        updatedAt: new Date().toISOString(),
        upstream: {
          installed: result.status.endsWith("_installed") || result.status.endsWith("_updated"),
          version: result.version,
          binaryPath: result.binaryPath,
          lastCheckedAt: new Date().toISOString(),
        },
      });
      formatIntegrationResult(result);
      return;
    }
    throw new UseAgentsError("Agent not found", "agent_not_found", { name: agentName });
  }

  for (const install of targets) {
    console.log(`==> Upgrading ${install.name}`);
    try {
      await installCommand(install.source);
      console.log(`==> ${install.name} upgraded`);
    } catch (e) {
      console.error(`==> ${install.name} upgrade failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
