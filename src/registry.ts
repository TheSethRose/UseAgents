import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

export const DEFAULT_REGISTRY_URL = "https://registry.useagents.io/v1";

export function getRegistryUrl(): string {
  return process.env.USEAGENTS_REGISTRY ?? DEFAULT_REGISTRY_URL;
}

export type RegistryEntryType = "packaged-agent" | "managed-integration";

export interface RegistryEntry {
  path: string;
  type: RegistryEntryType;
}

export const interimRegistry: Record<string, RegistryEntry> = {
  "goclaw": {
    path: join(PROJECT_ROOT, "examples", "goclaw"),
    type: "managed-integration",
  },
  "picoclaw": {
    path: join(PROJECT_ROOT, "examples", "picoclaw"),
    type: "managed-integration",
  },
  "pi-mono": {
    path: join(PROJECT_ROOT, "examples", "pi-mono"),
    type: "managed-integration",
  },
  "claude-code": {
    path: join(PROJECT_ROOT, "examples", "claude-code"),
    type: "managed-integration",
  },
  "gemini-cli": {
    path: join(PROJECT_ROOT, "examples", "gemini-cli"),
    type: "managed-integration",
  },
  "qwen-cli": {
    path: join(PROJECT_ROOT, "examples", "qwen-cli"),
    type: "managed-integration",
  },
  "nanoclaw": {
    path: join(PROJECT_ROOT, "examples", "nanoclaw"),
    type: "managed-integration",
  },
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
