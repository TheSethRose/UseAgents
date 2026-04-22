import { pathExists, getAgentActivePath, readJson, INSTALLS_FILE } from "../utils/filesystem.js";
import { UseAgentsError } from "../utils/errors.js";
import { installCommand } from "./install.js";
import { resolveInRegistry, isManagedIntegration } from "../registry.js";
import { loadManagedIntegration, upsertIntegrationRecord, formatIntegrationResult } from "../utils/integrations.js";
import type { InstallRecord } from "../types.js";

export async function updateCommand(agentName: string): Promise<void> {
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

  const activePath = getAgentActivePath(agentName);

  if (!await pathExists(activePath)) {
    throw new UseAgentsError("Agent not found", "agent_not_found", { name: agentName });
  }

  const installs = await readJson<InstallRecord[]>(INSTALLS_FILE) || [];
  const install = installs.find((i) => i.name === agentName);

  if (!install) {
    throw new UseAgentsError("Agent install record not found", "install_not_found", { name: agentName });
  }

  console.log(`Updating ${agentName} from ${install.source}...`);
  await installCommand(install.source);
}
