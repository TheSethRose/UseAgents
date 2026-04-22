import { pathExists, getAgentActivePath, getAgentRuntimeDir, removeDir, readJson, writeJson, INSTALLS_FILE } from "../utils/filesystem.js";
import { UseAgentsError } from "../utils/errors.js";
import { resolveInRegistry, isManagedIntegration } from "../registry.js";
import { loadManagedIntegration, removeIntegrationRecord, formatIntegrationResult } from "../utils/integrations.js";
import type { InstallRecord } from "../types.js";

export async function uninstallCommand(agentName: string): Promise<void> {
  if (isManagedIntegration(agentName)) {
    const entry = resolveInRegistry(agentName)!;
    const integration = await loadManagedIntegration(entry.path);
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
