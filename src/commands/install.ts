import { join } from "node:path";
import { execFileSync, execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readdir, writeFile } from "node:fs/promises";
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
import {
  assertRegistryVersionInstallable,
  fetchRegistryAgent,
  getRegistryArtifactUrl,
  isRegistryPackageName,
} from "../registry.js";
import { loadManagedIntegrationFromRegistry, upsertIntegrationRecord, formatIntegrationResult } from "../utils/integrations.js";
import { printKeyValues, section } from "../utils/cli.js";
import type { InstallRecord, Manifest } from "../types.js";

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

function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
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
  section(`Installing ${name}`);
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

async function findManifestRoot(extractDir: string): Promise<string> {
  if (await pathExists(join(extractDir, "agent.yaml"))) {
    return extractDir;
  }

  const entries = await readdir(extractDir, { withFileTypes: true });
  const directories = entries.filter((entry) => entry.isDirectory());
  if (directories.length === 1) {
    const candidate = join(extractDir, directories[0].name);
    if (await pathExists(join(candidate, "agent.yaml"))) {
      return candidate;
    }
  }

  throw new UseAgentsError("Registry agent tarball does not contain agent.yaml", "invalid_tarball");
}

async function installAgentFromPath(
  sourcePath: string,
  resolvedSource: string,
  options?: { force?: boolean; verbose?: boolean }
): Promise<Manifest> {
  const manifest = await loadManifest(sourcePath);
  const runtimeDir = getAgentRuntimeDir(manifest.name, manifest.version);

  if (await pathExists(runtimeDir)) {
    if (!options?.force) {
      console.log(`Agent ${manifest.name}@${manifest.version} already installed. Use --force to overwrite.`);
      return manifest;
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

  section(`Installed ${manifest.name}`);
  printKeyValues([
    ["Version", manifest.version],
    ["Type", "direct agent"],
    ["Source", resolvedSource],
    ["Runtime", manifest.runtime.type],
    ["Entrypoint", manifest.runtime.entrypoint],
  ]);

  console.log("\n==> Permissions");
  printKeyValues([
    ["Network", typeof manifest.permissions.network === "boolean" ? manifest.permissions.network : manifest.permissions.network.enabled],
    ["Secrets", manifest.permissions.secrets],
    ["Tools", manifest.tools],
    ["Filesystem read", manifest.permissions.filesystem.read],
    ["Filesystem write", manifest.permissions.filesystem.write],
  ]);

  return manifest;
}

async function installDirectAgentFromRegistry(
  name: string,
  options?: { force?: boolean; verbose?: boolean }
): Promise<void> {
  const agent = await fetchRegistryAgent(name);
  if (!agent) {
    throw new UseAgentsError("Agent not found in registry", "agent_not_found", { name });
  }

  const version = agent.latest;
  const versionInfo = agent.versions[version];
  if (!versionInfo) {
    throw new UseAgentsError("Registry agent version not found", "version_not_found", {
      name,
      version,
    });
  }
  assertRegistryVersionInstallable(agent, versionInfo, version);

  const cacheDir = join(CACHE_DIR, "registry", encodeURIComponent(name), version);
  const tarballPath = join(cacheDir, "agent.tar.gz");
  const extractDir = join(cacheDir, "extract");

  await removeDir(cacheDir);
  await mkdir(cacheDir, { recursive: true });

  const response = await fetch(getRegistryArtifactUrl(name, version, "tarball"));
  if (!response.ok) {
    throw new UseAgentsError("Failed to download registry agent tarball", "tarball_download_failed", {
      name,
      version,
      status: response.status,
    });
  }

  const tarball = Buffer.from(await response.arrayBuffer());
  if (versionInfo.artifactSha256 && sha256(tarball) !== versionInfo.artifactSha256) {
    throw new UseAgentsError("Registry agent tarball checksum mismatch", "artifact_checksum_mismatch", {
      name,
      version,
    });
  }
  await writeFile(tarballPath, tarball);
  await mkdir(extractDir, { recursive: true });

  try {
    execFileSync("tar", ["-xzf", tarballPath, "-C", extractDir], { stdio: "pipe" });
  } catch (error) {
    throw new UseAgentsError("Failed to extract registry agent tarball", "tarball_extract_failed", {
      name,
      version,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const sourcePath = await findManifestRoot(extractDir);
  await installAgentFromPath(sourcePath, `${name}@${version}`, options);
}

export async function installCommand(source: string, options?: { force?: boolean; verbose?: boolean }): Promise<void> {
  const isGitSource = source.startsWith("github:") || source.startsWith("https://") || source.startsWith("git@");
  const isRegistryName = isRegistryPackageName(source);
  const isLocalPath = !isGitSource && !isRegistryName && (source.startsWith(".") || source.startsWith("/") || source.includes("/") || source.includes("\\"));

  if (!isGitSource && !isLocalPath && isRegistryName) {
    const agent = await fetchRegistryAgent(source);
    if (agent) {
      if (agent.type === "managed-integration") {
        return installManagedIntegration(source, options);
      }
      if (agent.type === "direct-agent" || agent.type === "packaged-agent") {
        return installDirectAgentFromRegistry(source, options);
      }
      throw new UseAgentsError("Unsupported registry agent type", "unsupported_agent_type", {
        source,
        type: agent.type,
      });
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
  
  await installAgentFromPath(sourcePath, resolvedSource, options);
}
