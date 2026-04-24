import { join, dirname } from "node:path";
import { createHash } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import type { ManagedIntegrationRecord, IntegrationStore, IntegrationActionResult, ManagedIntegration } from "../types.js";
import { INTEGRATIONS_FILE, INTEGRATIONS_CACHE_DIR, readJson, writeJson, pathExists } from "./filesystem.js";
import { assertRegistryVersionInstallable, fetchRegistryAgent, getRegistryArtifactUrl } from "../registry.js";
import { printKeyValues, section } from "./cli.js";

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

function sha256(content: string): string {
  return createHash("sha256").update(content, "utf-8").digest("hex");
}

async function downloadWrapperJs(url: string, destPath: string, expectedSha256?: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Wrapper download failed: ${res.status} ${res.statusText}`);
  }
  const code = await res.text();
  if (expectedSha256 && sha256(code) !== expectedSha256) {
    throw new Error("Wrapper checksum mismatch");
  }
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
  assertRegistryVersionInstallable(agent, versionInfo, version);

  const wrapperUrl = getRegistryArtifactUrl(name, version, "wrapper");
  const integrationCacheDir = join(INTEGRATIONS_CACHE_DIR, encodeURIComponent(name), version);
  const wrapperPath = join(integrationCacheDir, "wrapper.mjs");

  await downloadWrapperJs(wrapperUrl, wrapperPath, versionInfo.artifactSha256);

  const mod = await import(`${wrapperPath}?t=${Date.now()}`);
  if (!mod.integration) {
    throw new Error(`Wrapper at ${wrapperPath} does not export 'integration'`);
  }
  return mod.integration as ManagedIntegration;
}

export function formatIntegrationResult(result: IntegrationActionResult): void {
  const name = typeof result.details?.name === "string" ? result.details.name : "Managed integration";
  section(name);
  console.log(result.summary);

  const rows = ([
    ["Status", formatStatus(result.status)],
    ["Binary", result.binaryPath],
  ] as Array<[string, unknown]>).filter(([, value]) => value !== undefined);

  if (rows.length > 0) {
    console.log();
    printKeyValues(rows);
  }

  if (result.commands && result.commands.length > 0) {
    console.log("\n==> Commands");
    for (const cmd of result.commands) {
      console.log(`  ${cmd}`);
    }
  }
  if (result.nextSteps && result.nextSteps.length > 0) {
    console.log("\n==> Next steps");
    for (const step of result.nextSteps) {
      console.log(`  ${step}`);
    }
  }
  if (result.details && Object.keys(result.details).length > 0) {
    console.log("\n==> Details");
    printKeyValues(Object.entries(result.details));
  }
}

function formatStatus(status: string): string {
  const parts = status.split("_");
  return (parts.length > 1 ? parts.slice(1).join(" ") : status).replace(/-/g, " ");
}
