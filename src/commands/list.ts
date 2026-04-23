import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { ACTIVE_DIR, pathExists } from "../utils/filesystem.js";
import { loadIntegrationStore } from "../utils/integrations.js";

export async function listCommand(agentName?: string): Promise<void> {
  const activeEntries = await getInstalledAgentNames();
  const store = await loadIntegrationStore();
  const integrationNames = Object.keys(store.integrations);

  const filteredAgents = agentName
    ? activeEntries.filter((name) => name === agentName)
    : activeEntries;

  const filteredIntegrations = agentName
    ? integrationNames.filter((name) => name === agentName)
    : integrationNames;

  if (filteredAgents.length === 0 && filteredIntegrations.length === 0) {
    if (agentName) {
      console.log(`No agent or integration named "${agentName}" installed.`);
    } else {
      console.log("No agents or integrations installed.");
    }
    return;
  }

  if (filteredAgents.length > 0) {
    console.log("Installed agents:");
    for (const name of filteredAgents) {
      console.log(`  ${name}`);
    }
  }

  if (filteredIntegrations.length > 0) {
    if (filteredAgents.length > 0) {
      console.log("");
    }
    console.log("Managed integrations:");
    for (const name of filteredIntegrations) {
      const record = store.integrations[name];
      const status = record.upstream.installed ? ` (${record.upstream.version ?? "unknown"})` : " (not installed)";
      console.log(`  ${name}${status}`);
    }
  }
}

async function getInstalledAgentNames(): Promise<string[]> {
  if (!await pathExists(ACTIVE_DIR)) {
    return [];
  }

  const entries = await readdir(ACTIVE_DIR);
  const names: string[] = [];

  for (const name of entries) {
    if (name.startsWith(".")) {
      continue;
    }
    if (await pathExists(join(ACTIVE_DIR, name))) {
      names.push(name);
    }
  }

  return names;
}
