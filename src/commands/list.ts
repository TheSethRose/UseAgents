import { readdir } from "node:fs/promises";
import { ACTIVE_DIR, INTEGRATIONS_FILE, pathExists, readJson } from "../utils/filesystem.js";
import type { IntegrationsState } from "../types.js";

export async function listCommand(): Promise<void> {
  const activeEntries = await pathExists(ACTIVE_DIR) ? await readdir(ACTIVE_DIR) : [];
  const integrations = (await readJson<IntegrationsState>(INTEGRATIONS_FILE))?.integrations ?? {};
  const integrationEntries = Object.values(integrations);

  if (activeEntries.length === 0 && integrationEntries.length === 0) {
    console.log("No agents installed.");
    return;
  }

  if (activeEntries.length > 0) {
    console.log("Installed agents:");
  }
  for (const name of activeEntries) {
    console.log(`  ${name}`);
  }

  if (integrationEntries.length > 0) {
    console.log("Managed integrations:");
  }
  for (const integration of integrationEntries) {
    const upstream = integration.upstream.installed
      ? integration.upstream.version ?? "installed"
      : "not installed";
    console.log(`  ${integration.name} (${integration.kind}, upstream: ${upstream})`);
  }
}
