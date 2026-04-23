import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { ACTIVE_DIR, getAgentActivePath, INSTALLS_FILE, pathExists, readJson } from "../utils/filesystem.js";
import { loadIntegrationStore } from "../utils/integrations.js";
import { loadManifest } from "../utils/manifest.js";
import { printTable, section } from "../utils/cli.js";
import type { InstallRecord, Manifest } from "../types.js";

interface AgentRow {
  name: string;
  version: string;
  runtime: string;
  source: string;
}

interface IntegrationRow {
  name: string;
  version: string;
  method: string;
  status: string;
}

export async function listCommand(agentName?: string): Promise<void> {
  const activeEntries = await getInstalledAgentNames();
  const store = await loadIntegrationStore();
  const integrationNames = Object.keys(store.integrations);
  const installs = await readJson<InstallRecord[]>(INSTALLS_FILE) || [];

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
    section("Agents");
    printTable(await Promise.all(filteredAgents.map((name) => buildAgentRow(name, installs))), [
      { header: "Name", value: (row) => row.name },
      { header: "Version", value: (row) => row.version },
      { header: "Runtime", value: (row) => row.runtime },
      { header: "Source", value: (row) => row.source },
    ]);
  }

  if (filteredIntegrations.length > 0) {
    if (filteredAgents.length > 0) {
      console.log("");
    }
    section("Managed integrations");
    const rows: IntegrationRow[] = filteredIntegrations.map((name) => {
      const record = store.integrations[name];
      return {
        name,
        version: record.upstream.version ?? "unknown",
        method: record.upstream.installMethod ?? "unknown",
        status: record.upstream.installed ? "installed" : "not installed",
      };
    });
    printTable(rows, [
      { header: "Name", value: (row) => row.name },
      { header: "Version", value: (row) => row.version },
      { header: "Method", value: (row) => row.method },
      { header: "Status", value: (row) => row.status },
    ]);
  }
}

async function buildAgentRow(name: string, installs: InstallRecord[]): Promise<AgentRow> {
  let manifest: Manifest | undefined;
  try {
    manifest = await loadManifest(getAgentActivePath(name));
  } catch {
  }
  const install = installs.find((record) => record.name === name);
  return {
    name,
    version: manifest?.version ?? install?.version ?? "unknown",
    runtime: manifest?.runtime.type ?? "unknown",
    source: install?.source ?? "unknown",
  };
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
