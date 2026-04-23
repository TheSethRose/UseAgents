import { pathExists, getAgentActivePath, getAgentRuntimeDir, removeDir, readJson, writeJson, INSTALLS_FILE } from "../utils/filesystem.js";
import { UseAgentsError } from "../utils/errors.js";
import { isManagedIntegration } from "../registry.js";
import { loadManagedIntegrationFromRegistry, removeIntegrationRecord, formatIntegrationResult } from "../utils/integrations.js";
import type { InstallRecord } from "../types.js";

export async function uninstallCommand(agentName: string): Promise<void> {
  if (await isManagedIntegration(agentName)) {
    const integration = await loadManagedIntegrationFromRegistry(agentName);
    const result = await integration.uninstall();
    await removeIntegrationRecord(agentName);
    formatIntegrationResult(result);
    return;
  }

  const activePath = getAgentActivePath(agentName);

  if (!await pathExists(activePath)) {
    throw new UseAgentsError("Agent not found", "agent_not_found", { name: agentName });
  }

  const runtimeDir = getAgentRuntimeDir(agentName, "*");
  const runtimeParent = runtimeDir.replace(/\/\*$/, "");

  if (await pathExists(runtimeParent)) {
    await removeDir(runtimeParent);
  }

  if (await pathExists(activePath)) {
    await removeDir(activePath);
  }

  const installs = await readJson<InstallRecord[]>(INSTALLS_FILE) || [];
  const filtered = installs.filter((i) => i.name !== agentName);
  await writeJson(INSTALLS_FILE, filtered);

  console.log(`Uninstalled ${agentName}`);
}
