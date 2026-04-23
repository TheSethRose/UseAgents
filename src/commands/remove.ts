import { pathExists, getAgentActivePath, getAgentRuntimeDir, removeDir, readJson, writeJson, INSTALLS_FILE } from "../utils/filesystem.js";
import { UseAgentsError } from "../utils/errors.js";
import { isManagedIntegration } from "../registry.js";
import { removeIntegrationRecord } from "../utils/integrations.js";
import type { InstallRecord } from "../types.js";

export async function removeCommand(agentName: string): Promise<void> {
  if (await hasLocalInstall(agentName)) {
    await removeLocalAgent(agentName);
    console.log(`Removed ${agentName}`);
    return;
  }

  if (await isManagedIntegration(agentName)) {
    await removeIntegrationRecord(agentName);
    console.log(`Removed ${agentName} from UseAgents (upstream installation left intact).`);
    return;
  }

  throw new UseAgentsError("Agent not found", "agent_not_found", { name: agentName });
}

async function hasLocalInstall(agentName: string): Promise<boolean> {
  const activePath = getAgentActivePath(agentName);
  if (await pathExists(activePath)) {
    return true;
  }

  const installs = await readJson<InstallRecord[]>(INSTALLS_FILE) || [];
  return installs.some((i) => i.name === agentName);
}

async function removeLocalAgent(agentName: string): Promise<void> {
  const activePath = getAgentActivePath(agentName);
  const runtimeDir = getAgentRuntimeDir(agentName, "*");
  const runtimeParent = runtimeDir.replace(/\/\*$/, "");

  await removeDir(activePath);

  if (await pathExists(runtimeParent)) {
    await removeDir(runtimeParent);
  }

  const installs = await readJson<InstallRecord[]>(INSTALLS_FILE) || [];
  const filtered = installs.filter((i) => i.name !== agentName);
  await writeJson(INSTALLS_FILE, filtered);
}
