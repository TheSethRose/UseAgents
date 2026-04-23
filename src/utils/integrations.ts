import { join, dirname } from "node:path";
import { writeFile, mkdir } from "node:fs/promises";
import type { ManagedIntegrationRecord, IntegrationStore, IntegrationActionResult, ManagedIntegration } from "../types.js";
import { INTEGRATIONS_FILE, INTEGRATIONS_CACHE_DIR, readJson, writeJson, pathExists } from "./filesystem.js";
import { fetchRegistryAgent, getRegistryUrl } from "../registry.js";

export async function loadIntegrationStore(): Promise<IntegrationStore> {
  const store = await readJson<IntegrationStore>(INTEGRATIONS_FILE);
  return store ?? { integrations: {} };
}

export async function saveIntegrationStore(store: IntegrationStore): Promise<void> {
  await writeJson(INTEGRATIONS_FILE, store);
}

export async function getIntegrationRecord(name: string): Promise<ManagedIntegrationRecord | undefined> {
  const store = await loadIntegrationStore();
  return store.integrations[name];
}

export async function upsertIntegrationRecord(record: ManagedIntegrationRecord): Promise<void> {
  const store = await loadIntegrationStore();
  store.integrations[record.name] = record;
  await saveIntegrationStore(store);
}

export async function removeIntegrationRecord(name: string): Promise<void> {
  const store = await loadIntegrationStore();
  delete store.integrations[name];
  await saveIntegrationStore(store);
}

export async function loadManagedIntegration(path: string): Promise<ManagedIntegration> {
  const indexPath = join(path, "dist", "index.js");
  if (!await pathExists(indexPath)) {
    throw new Error(`Managed integration entry not found: ${indexPath}`);
  }
  const mod = await import(indexPath);
  if (!mod.integration) {
    throw new Error(`Managed integration at ${path} does not export 'integration'`);
  }
  return mod.integration as ManagedIntegration;
}

async function downloadWrapperJs(url: string, destPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Wrapper download failed: ${res.status} ${res.statusText}`);
  }
  const code = await res.text();
  await mkdir(dirname(destPath), { recursive: true });
  await writeFile(destPath, code, "utf-8");
}

export async function loadManagedIntegrationFromRegistry(name: string): Promise<ManagedIntegration> {
  const agent = await fetchRegistryAgent(name);
  if (!agent || agent.type !== "managed-integration") {
    throw new Error(`Managed integration not found in registry: ${name}`);
  }

  const version = agent.latest;
  const versionInfo = agent.versions[version];
  if (!versionInfo) {
    throw new Error(`Version ${version} not found for ${name}`);
  }

  const wrapperUrl = `${getRegistryUrl()}/agents/${name}/${version}/wrapper`;
  const integrationCacheDir = join(INTEGRATIONS_CACHE_DIR, name, version);
  const wrapperPath = join(integrationCacheDir, "wrapper.mjs");

  if (!await pathExists(wrapperPath)) {
    await downloadWrapperJs(wrapperUrl, wrapperPath);
  }

  const mod = await import(wrapperPath);
  if (!mod.integration) {
    throw new Error(`Wrapper at ${wrapperPath} does not export 'integration'`);
  }
  return mod.integration as ManagedIntegration;
}

export function formatIntegrationResult(result: IntegrationActionResult): void {
  console.log(`${result.summary}`);
  if (result.version) {
    console.log(`Version: ${result.version}`);
  }
  if (result.previousVersion) {
    console.log(`Previous version: ${result.previousVersion}`);
  }
  if (result.binaryPath) {
    console.log(`Binary path: ${result.binaryPath}`);
  }
  if (result.commands && result.commands.length > 0) {
    console.log("Commands:");
    for (const cmd of result.commands) {
      console.log(`  ${cmd}`);
    }
  }
  if (result.nextSteps && result.nextSteps.length > 0) {
    console.log("Next steps:");
    for (const step of result.nextSteps) {
      console.log(`  ${step}`);
    }
  }
  if (result.details && Object.keys(result.details).length > 0) {
    console.log("Details:");
    for (const [key, value] of Object.entries(result.details)) {
      console.log(`  ${key}: ${value}`);
    }
  }
}
