import { readJson, AUTH_FILE } from "./utils/filesystem.js";

export const DEFAULT_REGISTRY_URL = "https://registry.useagents.io/v1";

export function getRegistryUrl(): string {
  return process.env.USEAGENTS_REGISTRY ?? DEFAULT_REGISTRY_URL;
}

export interface RegistryAgentVersion {
  manifestUrl: string;
  tarballUrl?: string;
  wrapperUrl?: string;
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
}

export async function fetchRegistryAgent(name: string): Promise<RegistryAgent | undefined> {
  const registryUrl = getRegistryUrl();
  try {
    const res = await fetch(`${registryUrl}/agents/${name}`);
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
