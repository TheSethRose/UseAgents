import { pathExists, getAgentActivePath, readJson, INSTALLS_FILE } from "../utils/filesystem.js";
import { loadManifest } from "../utils/manifest.js";
import { UseAgentsError } from "../utils/errors.js";
import type { InstallRecord } from "../types.js";
import { infoOpenClawIntegration, isManagedOpenClaw } from "../integrations/openclaw.js";

export async function infoCommand(agentName: string): Promise<void> {
  if (isManagedOpenClaw(agentName)) {
    await infoOpenClawIntegration();
    return;
  }

  const activePath = getAgentActivePath(agentName);
  
  if (!await pathExists(activePath)) {
    throw new UseAgentsError("Agent not found", "agent_not_found", { name: agentName });
  }
  
  const manifest = await loadManifest(activePath);
  const installs = await readJson<InstallRecord[]>(INSTALLS_FILE) || [];
  const install = installs.find((i) => i.name === agentName);
  
  console.log(`Name: ${manifest.name}`);
  console.log(`Version: ${manifest.version}`);
  console.log(`Description: ${manifest.description}`);
  console.log(`Runtime: ${manifest.runtime.type}`);
  console.log(`Entrypoint: ${manifest.runtime.entrypoint}`);
  
  if (manifest.model) {
    console.log(`Model: ${manifest.model.provider}/${manifest.model.model}`);
  }
  
  console.log(`Install path: ${activePath}`);
  console.log(`Source: ${install?.source || "unknown"}`);
  console.log(`Installed: ${install?.installedAt || "unknown"}`);
  console.log(`\nPermissions:`);
  console.log(`  Network: ${manifest.permissions.network ? "yes" : "no"}`);
  console.log(`  Secrets: ${manifest.permissions.secrets.join(", ") || "none"}`);
  console.log(`  Tools: ${manifest.tools.join(", ") || "none"}`);
  console.log(`  Filesystem read: ${manifest.permissions.filesystem.read.join(", ") || "none"}`);
  console.log(`  Filesystem write: ${manifest.permissions.filesystem.write.join(", ") || "none"}`);
}
