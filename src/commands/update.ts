import { pathExists, getAgentActivePath, readJson, INSTALLS_FILE } from "../utils/filesystem.js";
import { UseAgentsError } from "../utils/errors.js";
import { installCommand } from "./install.js";
import { isManagedIntegration, getRegistryUrl } from "../registry.js";
import { loadManagedIntegrationFromRegistry, upsertIntegrationRecord, formatIntegrationResult } from "../utils/integrations.js";
import type { InstallRecord } from "../types.js";

export async function updateCommand(agentName?: string): Promise<void> {
  if (agentName) {
    if (await isManagedIntegration(agentName)) {
      const integration = await loadManagedIntegrationFromRegistry(agentName);
      
      const originalPipFlag = process.env.PIP_BREAK_SYSTEM_PACKAGES;
      process.env.PIP_BREAK_SYSTEM_PACKAGES = "1";

      try {
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
      } finally {
        if (originalPipFlag === undefined) {
          delete process.env.PIP_BREAK_SYSTEM_PACKAGES;
        } else {
          process.env.PIP_BREAK_SYSTEM_PACKAGES = originalPipFlag;
        }
      }
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

    console.log(`==> Updating ${agentName} from ${install.source}...`);
    await installCommand(install.source);
    return;
  }

  console.log("==> Updating registry metadata");
  const registryUrl = getRegistryUrl();
  try {
    const res = await fetch(`${registryUrl}/agents`);
    if (res.ok) {
      console.log(`==> Registry metadata updated (${registryUrl})`);
    } else {
      console.log(`==> Registry update failed (${res.status})`);
    }
  } catch {
    console.log(`==> Registry unreachable (${registryUrl})`);
  }
}
