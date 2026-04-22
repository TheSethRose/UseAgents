import { readdir } from "node:fs/promises";
import { ACTIVE_DIR, pathExists } from "../utils/filesystem.js";
import { loadIntegrationStore } from "../utils/integrations.js";

export async function listCommand(): Promise<void> {
  const activeEntries = await pathExists(ACTIVE_DIR) ? await readdir(ACTIVE_DIR) : [];
  const store = await loadIntegrationStore();
  const integrationNames = Object.keys(store.integrations);

  if (activeEntries.length === 0 && integrationNames.length === 0) {
    console.log("No agents or integrations installed.");
    return;
  }

  if (activeEntries.length > 0) {
    console.log("Installed agents:");
    for (const name of activeEntries) {
      console.log(`  ${name}`);
    }
  }

  if (integrationNames.length > 0) {
    if (activeEntries.length > 0) {
      console.log("");
    }
    console.log("Managed integrations:");
    for (const name of integrationNames) {
      const record = store.integrations[name];
      const status = record.upstream.installed ? ` (${record.upstream.version ?? "unknown"})` : " (not installed)";
      console.log(`  ${name}${status}`);
    }
  }
}
