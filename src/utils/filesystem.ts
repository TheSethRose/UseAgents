import { mkdir, readFile, writeFile, access, cp, rm, lstat, symlink, readlink } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve, dirname } from "node:path";

export const USEAGENTS_DIR = join(homedir(), ".useagents");
export const RUNTIMES_DIR = join(USEAGENTS_DIR, "runtimes");
export const ACTIVE_DIR = join(USEAGENTS_DIR, "active");
export const STATE_DIR = join(USEAGENTS_DIR, "state");
export const SECRETS_DIR = join(USEAGENTS_DIR, "secrets");
export const CACHE_DIR = join(USEAGENTS_DIR, "cache");
export const INTEGRATIONS_CACHE_DIR = join(CACHE_DIR, "integrations");

export const INSTALLS_FILE = join(STATE_DIR, "installs.json");
export const INTEGRATIONS_FILE = join(STATE_DIR, "integrations.json");
export const LOGS_FILE = join(STATE_DIR, "logs.jsonl");
export const AUDIT_LOGS_FILE = join(STATE_DIR, "audit.jsonl");
export const PERMISSIONS_FILE = join(STATE_DIR, "permissions.json");
export const SECRETS_FILE = join(SECRETS_DIR, "secrets.json");
export const AUTH_FILE = join(STATE_DIR, "auth.json");

export async function ensureDirs(): Promise<void> {
  await mkdir(RUNTIMES_DIR, { recursive: true });
  await mkdir(ACTIVE_DIR, { recursive: true });
  await mkdir(STATE_DIR, { recursive: true });
  await mkdir(SECRETS_DIR, { recursive: true });
  await mkdir(CACHE_DIR, { recursive: true });
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function readJson<T>(path: string): Promise<T | undefined> {
  try {
    const content = await readFile(path, "utf-8");
    return JSON.parse(content) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

export async function readJsonl<T>(path: string): Promise<T[]> {
  try {
    const content = await readFile(path, "utf-8");
    return content
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as T);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function writeJson(path: string, data: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

export async function appendJsonl(path: string, data: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data) + "\n", { flag: "a", encoding: "utf-8" });
}

export async function copyDir(src: string, dest: string): Promise<void> {
  await cp(src, dest, { recursive: true, preserveTimestamps: true });
}

export async function removeDir(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true });
}

export function encodeAgentPathName(name: string): string {
  return encodeURIComponent(name);
}

export function decodeAgentPathName(name: string): string {
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

export function getAgentRuntimeDir(name: string, version: string): string {
  return join(RUNTIMES_DIR, encodeAgentPathName(name), version);
}

export function getAgentActivePath(name: string): string {
  return join(ACTIVE_DIR, encodeAgentPathName(name));
}

export async function setActiveVersion(name: string, version: string): Promise<void> {
  const runtimeDir = getAgentRuntimeDir(name, version);
  const activePath = getAgentActivePath(name);
  
  await mkdir(dirname(activePath), { recursive: true });
  
  try {
    await lstat(activePath);
    await rm(activePath, { recursive: true, force: true });
  } catch {
  }
  
  await symlink(runtimeDir, activePath, "junction");
}

export async function getActiveVersion(name: string): Promise<string | undefined> {
  const activePath = getAgentActivePath(name);
  try {
    const target = await readlink(activePath);
    const parts = target.split(/[/\\]/);
    return parts[parts.length - 1];
  } catch {
    return undefined;
  }
}

export function normalizePath(inputPath: string, basePath: string): string {
  if (inputPath.startsWith("/")) {
    return resolve(inputPath);
  }
  return resolve(join(basePath, inputPath));
}
