import { pathExists, getAgentActivePath, readJson, INSTALLS_FILE } from "../utils/filesystem.js";
import { loadManifest } from "../utils/manifest.js";
import { UseAgentsError } from "../utils/errors.js";
import { isManagedIntegration } from "../registry.js";
import { loadManagedIntegrationFromRegistry, formatIntegrationResult } from "../utils/integrations.js";
import { printKeyValues, section } from "../utils/cli.js";
import type { InstallRecord } from "../types.js";

export async function infoCommand(agentName: string | string[], ...rest: unknown[]): Promise<void> {
  const names = Array.isArray(agentName) ? agentName : typeof agentName === "string" ? [agentName, ...rest.filter((a): a is string => typeof a === "string")] : [];

  if (names.length === 0) {
    throw new UseAgentsError("No agent specified", "missing_argument");
  }

  for (const name of names) {
    if (names.length > 1) {
      console.log(`==> ${name}`);
    }

    if (await isManagedIntegration(name)) {
      const integration = await loadManagedIntegrationFromRegistry(name);
      const result = await integration.info();
      formatIntegrationResult(result);
      continue;
    }

    const activePath = getAgentActivePath(name);

    if (!await pathExists(activePath)) {
      throw new UseAgentsError("Agent not found", "agent_not_found", { name });
    }

    const manifest = await loadManifest(activePath);
    const installs = await readJson<InstallRecord[]>(INSTALLS_FILE) || [];
    const install = installs.find((i) => i.name === name);

    section(manifest.name);
    console.log(manifest.description);
    console.log();
    printKeyValues([
      ["Type", "direct agent"],
      ["Version", manifest.version],
      ["Runtime", manifest.runtime.type],
      ["Entrypoint", manifest.runtime.entrypoint],
      ["Model", manifest.model ? `${manifest.model.provider}/${manifest.model.model}` : undefined],
      ["Install path", activePath],
      ["Source", install?.source],
      ["Installed", install?.installedAt],
    ]);

    console.log("\n==> Permissions");
    printKeyValues([
      ["Network", typeof manifest.permissions.network === "boolean" ? manifest.permissions.network : manifest.permissions.network.enabled],
      ["Secrets", manifest.permissions.secrets],
      ["Tools", manifest.tools],
      ["Filesystem read", manifest.permissions.filesystem.read],
      ["Filesystem write", manifest.permissions.filesystem.write],
    ]);
  }
}
