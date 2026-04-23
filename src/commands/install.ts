import { join } from "node:path";
import { execSync } from "node:child_process";
import { cwd } from "node:process";
import { loadManifest } from "../utils/manifest.js";
import { UseAgentsError } from "../utils/errors.js";
import {
  copyDir,
  removeDir,
  pathExists,
  getAgentRuntimeDir,
  setActiveVersion,
  readJson,
  writeJson,
  INSTALLS_FILE,
  CACHE_DIR,
} from "../utils/filesystem.js";
import { fetchRegistryAgent } from "../registry.js";
import { loadManagedIntegrationFromRegistry, upsertIntegrationRecord, formatIntegrationResult } from "../utils/integrations.js";
import type { InstallRecord } from "../types.js";

async function ensureEsmPackageJson(runtimeDir: string): Promise<void> {
  const pkgPath = join(runtimeDir, "package.json");
  if (!await pathExists(pkgPath)) {
    await writeJson(pkgPath, { type: "module" });
  }
}

function parseGitSource(source: string): { url: string; shorthand: boolean } {
  if (source.startsWith("github:")) {
    const [, owner, repo] = source.match(/^github:([^/]+)\/(.+)$/) || [];
    if (!owner || !repo) {
      throw new UseAgentsError("Invalid GitHub shorthand", "invalid_source", { source });
    }
    return { url: `https://github.com/${owner}/${repo}`, shorthand: true };
  }
  if (source.startsWith("https://github.com/")) {
    return { url: source, shorthand: false };
  }
  if (source.startsWith("git@github.com:")) {
    return { url: source, shorthand: false };
  }
  return { url: source, shorthand: false };
}

async function cloneGitRepo(url: string): Promise<string> {
  const cacheName = url.replace(/[^a-zA-Z0-9]/g, "_");
  const cachePath = join(CACHE_DIR, cacheName);
  
  if (await pathExists(cachePath)) {
    await removeDir(cachePath);
  }
  
  try {
    execSync(`git clone --depth 1 "${url}" "${cachePath}"`, { stdio: "pipe" });
  } catch (e) {
    throw new UseAgentsError(
      "Failed to clone git repository",
      "git_clone_failed",
      { url, error: e instanceof Error ? e.message : String(e) }
    );
  }
  
  return cachePath;
}

export async function resolveLocalSourcePath(source: string): Promise<string> {
  const directPath = join(cwd(), source);
  if (await pathExists(directPath)) {
    return directPath;
  }

  const looksLikeAlias = !source.includes("/") && !source.includes("\\") && !source.startsWith(".");
  if (looksLikeAlias) {
    const examplePath = join(cwd(), "examples", source);
    if (await pathExists(examplePath)) {
      return examplePath;
    }
  }

  throw new UseAgentsError("Source path does not exist", "source_not_found", { path: directPath });
}

async function installManagedIntegration(name: string, options?: { force?: boolean }): Promise<void> {
  console.log(`Installing ${name}...`);
  const integration = await loadManagedIntegrationFromRegistry(name);
  const result = await integration.install({ force: options?.force });
  await upsertIntegrationRecord({
    name: integration.name,
    kind: "managed-external",
    wrapperVersion: integration.wrapperVersion,
    installedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    upstream: {
      installed: result.status.endsWith("_installed") || result.status.endsWith("_updated"),
      version: result.version,
      binaryPath: result.binaryPath,
      installMethod: "official-installer",
      lastCheckedAt: new Date().toISOString(),
    },
  });
  formatIntegrationResult(result);
}

export async function installCommand(source: string, options?: { force?: boolean; verbose?: boolean }): Promise<void> {
  const isGitSource = source.startsWith("github:") || source.startsWith("https://") || source.startsWith("git@");
  const isLocalPath = !isGitSource && (source.startsWith(".") || source.startsWith("/") || source.includes("/") || source.includes("\\"));

  if (!isGitSource && !isLocalPath) {
    const agent = await fetchRegistryAgent(source);
    if (agent) {
      if (agent.type === "managed-integration") {
        return installManagedIntegration(source, options);
      }
      throw new UseAgentsError("Packaged agent installation not yet supported", "not_supported", { source });
    }
  }

  let sourcePath: string;
  let resolvedSource = source;

  if (isGitSource) {
    const git = parseGitSource(source);
    console.log(`Cloning ${git.url}...`);
    sourcePath = await cloneGitRepo(git.url);
    resolvedSource = git.url;
  } else {
    sourcePath = await resolveLocalSourcePath(source);
    resolvedSource = sourcePath;
  }
  
  const manifest = await loadManifest(sourcePath);
  const runtimeDir = getAgentRuntimeDir(manifest.name, manifest.version);
  
  if (await pathExists(runtimeDir)) {
    if (!options?.force) {
      console.log(`Agent ${manifest.name}@${manifest.version} already installed. Use --force to overwrite.`);
      return;
    }
    if (options?.verbose) {
      console.log(`==> Removing existing ${manifest.name}@${manifest.version}`);
    }
    await removeDir(runtimeDir);
  }
  
  await copyDir(sourcePath, runtimeDir);
  await ensureEsmPackageJson(runtimeDir);
  await setActiveVersion(manifest.name, manifest.version);
  
  const installs = await readJson<InstallRecord[]>(INSTALLS_FILE) || [];
  const existingIndex = installs.findIndex((i) => i.name === manifest.name);
  const record: InstallRecord = {
    name: manifest.name,
    version: manifest.version,
    source: resolvedSource,
    installedAt: new Date().toISOString(),
    active: true,
  };
  
  if (existingIndex >= 0) {
    installs[existingIndex] = record;
  } else {
    installs.push(record);
  }
  
  await writeJson(INSTALLS_FILE, installs);
  
  console.log(`Installed ${manifest.name}@${manifest.version}`);
  console.log(`Permissions requested:`);
  console.log(`  Network: ${manifest.permissions.network ? "yes" : "no"}`);
  console.log(`  Secrets: ${manifest.permissions.secrets.join(", ") || "none"}`);
  console.log(`  Tools: ${manifest.tools.join(", ") || "none"}`);
  console.log(`  Filesystem read: ${manifest.permissions.filesystem.read.join(", ") || "none"}`);
  console.log(`  Filesystem write: ${manifest.permissions.filesystem.write.join(", ") || "none"}`);
}
