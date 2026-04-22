import { join } from "node:path";
import type { ManagedIntegrationRecord, IntegrationStore, IntegrationActionResult, ManagedIntegration } from "../types.js";
import { INTEGRATIONS_FILE, readJson, writeJson, pathExists } from "./filesystem.js";

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
