import { readJson, AUTH_FILE } from "./utils/filesystem.js";

export const DEFAULT_REGISTRY_URL = "https://registry.useagents.io/v1";

export function getRegistryUrl(): string {
  return process.env.USEAGENTS_REGISTRY ?? DEFAULT_REGISTRY_URL;
}

export type RegistryEntryType = "packaged-agent" | "managed-integration";

export interface RegistryEntry {
  path: string;
  type: RegistryEntryType;
}

export const interimRegistry: Record<string, RegistryEntry> = {};

export function resolveInRegistry(name: string): RegistryEntry | undefined {
  return interimRegistry[name];
}

export function isManagedIntegration(name: string): boolean {
  return resolveInRegistry(name)?.type === "managed-integration";
}

export function isPackagedAgent(name: string): boolean {
  return resolveInRegistry(name)?.type === "packaged-agent";
}

export function listRegistryEntries(): Array<{ name: string } & RegistryEntry> {
  return Object.entries(interimRegistry).map(([name, entry]) => ({ name, ...entry }));
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
