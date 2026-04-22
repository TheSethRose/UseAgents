import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

export type RegistryEntryType = "packaged-agent" | "managed-integration";

export interface RegistryEntry {
  path: string;
  type: RegistryEntryType;
}

export const interimRegistry: Record<string, RegistryEntry> = {
  "openclaw": {
    path: join(PROJECT_ROOT, "examples", "openclaw"),
    type: "managed-integration",
  },
  "hermes": {
    path: join(PROJECT_ROOT, "examples", "hermes"),
    type: "managed-integration",
  },
  "hello-world": {
    path: join(PROJECT_ROOT, "examples", "hello-world"),
    type: "packaged-agent",
  },
};

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
