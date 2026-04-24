import { readJson, AUTH_FILE } from "./utils/filesystem.js";
import { UseAgentsError } from "./utils/errors.js";

export const DEFAULT_REGISTRY_URL = "https://registry.useagents.io/v1";

export function getRegistryUrl(): string {
  return process.env.USEAGENTS_REGISTRY ?? DEFAULT_REGISTRY_URL;
}

export type RegistryPackageStatus = "active" | "deprecated" | "quarantined" | "archived" | "deleted";
export type RegistryVersionStatus = "active" | "deprecated" | "yanked" | "quarantined";

export interface RegistryAgentVersion {
  manifestUrl: string;
  tarballUrl?: string;
  wrapperUrl?: string;
  artifactSha256?: string;
  status?: RegistryVersionStatus;
  publishedAt: string;
}

export type RegistryAgentType = "direct-agent" | "managed-integration" | "packaged-agent";

export interface RegistryAgent {
  name: string;
  type: RegistryAgentType;
  description: string;
  author: string;
  versions: Record<string, RegistryAgentVersion>;
  latest: string;
  status?: RegistryPackageStatus;
}

export function isScopedRegistryName(name: string): boolean {
  return /^@[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*$/.test(name);
}

export function isUnscopedRegistryName(name: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/.test(name);
}

export function isRegistryPackageName(name: string): boolean {
  return isScopedRegistryName(name) || isUnscopedRegistryName(name);
}

export function getRegistryPackageUrl(name: string): string {
  const registryUrl = getRegistryUrl();
  if (isScopedRegistryName(name)) {
    const [scope, packageName] = name.split("/");
    return `${registryUrl}/packages/${encodeURIComponent(scope)}/${encodeURIComponent(packageName)}`;
  }
  return `${registryUrl}/agents/${encodeURIComponent(name)}`;
}

export function getRegistryArtifactUrl(name: string, version: string, artifact: "tarball" | "wrapper" | "manifest"): string {
  return `${getRegistryPackageUrl(name)}/${encodeURIComponent(version)}/${artifact}`;
}

export async function fetchRegistryAgent(name: string): Promise<RegistryAgent | undefined> {
  try {
    const res = await fetch(getRegistryPackageUrl(name));
    if (!res.ok) {
      return undefined;
    }
    return (await res.json()) as RegistryAgent;
  } catch {
    return undefined;
  }
}

export async function isManagedIntegration(name: string): Promise<boolean> {
  const agent = await fetchRegistryAgent(name);
  return agent?.type === "managed-integration";
}

export async function isDirectAgent(name: string): Promise<boolean> {
  const agent = await fetchRegistryAgent(name);
  return agent?.type === "direct-agent" || agent?.type === "packaged-agent";
}

export function assertRegistryVersionInstallable(
  agent: RegistryAgent,
  versionInfo: RegistryAgentVersion,
  version: string
): void {
  if (agent.status === "quarantined" || agent.status === "deleted" || agent.status === "archived") {
    throw new UseAgentsError("Registry package is not installable", "registry_package_blocked", {
      name: agent.name,
      status: agent.status,
    });
  }
  if (versionInfo.status === "quarantined" || versionInfo.status === "yanked") {
    throw new UseAgentsError("Registry package version is not installable", "registry_version_blocked", {
      name: agent.name,
      version,
      status: versionInfo.status,
    });
  }
  if (agent.status === "deprecated" || versionInfo.status === "deprecated") {
    console.warn(`Warning: ${agent.name}@${version} is deprecated.`);
  }
}

export async function getAuthToken(): Promise<string | undefined> {
  const auth = await readJson<{ registryToken?: string }>(AUTH_FILE);
  return auth?.registryToken;
}

export async function createRegistryHeaders(): Promise<Record<string, string>> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}
