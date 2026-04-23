import { readFile, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import type { Manifest, ToolContext, AuditLogEntry } from "../types.js";
import { UseAgentsError } from "../utils/errors.js";
import { appendJsonl } from "../utils/filesystem.js";

function normalizePath(inputPath: string, basePath: string): string {
  if (inputPath.startsWith("/")) {
    return resolve(inputPath);
  }
  return resolve(join(basePath, inputPath));
}

function checkPathAllowed(path: string, allowedPaths: string[], basePath: string): boolean {
  const normalized = normalizePath(path, basePath);
  for (const allowed of allowedPaths) {
    const normalizedAllowed = normalizePath(allowed, basePath);
    const relativePath = relative(normalizedAllowed, normalized);
    if (relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath))) {
      return true;
    }
  }
  return false;
}

function getDomainFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return "";
  }
}

export function matchDomain(domain: string, pattern: string): boolean {
  if (pattern === "*") return true;
  if (pattern.startsWith("*.")) {
    const suffix = pattern.slice(2);
    return domain === suffix || domain.endsWith("." + suffix);
  }
  return domain === pattern;
}

export function isNetworkAllowed(
  network: boolean | { enabled: boolean; domains: string[] },
  url: string
): boolean {
  if (typeof network === "boolean") {
    return network;
  }
  if (!network.enabled) return false;
  if (network.domains.length === 0) return true;

  const domain = getDomainFromUrl(url);
  return network.domains.some((pattern) => matchDomain(domain, pattern));
}

let auditLogFile: string | undefined;
let agentNameForAudit: string | undefined;

export function setAuditLogConfig(file: string, agentName: string): void {
  auditLogFile = file;
  agentNameForAudit = agentName;
}

async function logAudit(entry: Omit<AuditLogEntry, "timestamp" | "agentName">): Promise<void> {
  if (!auditLogFile || !agentNameForAudit) return;
  const fullEntry: AuditLogEntry = {
    timestamp: new Date().toISOString(),
    agentName: agentNameForAudit,
    ...entry,
  };
  await appendJsonl(auditLogFile, fullEntry);
}

const builtInTools = {
  "echo.text": async (input: unknown, _ctx: ToolContext) => {
    const { text } = input as { text: string };
    return { text };
  },

  "http.fetch": async (input: unknown, ctx: ToolContext) => {
    const { url, method = "GET", headers, body } = input as {
      url: string;
      method?: string;
      headers?: Record<string, string>;
      body?: string;
    };

    const allowed = isNetworkAllowed(ctx.permissions.network, url);
    await logAudit({
      operation: "network.fetch",
      url,
      allowed,
      details: { method },
    });

    if (!allowed) {
      throw new UseAgentsError("Network access not permitted", "network_denied");
    }

    const response = await fetch(url, { method, headers, body });
    const text = await response.text();
    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: text,
    };
  },

  "fs.readText": async (input: unknown, ctx: ToolContext) => {
    const { path } = input as { path: string };
    const allowed = checkPathAllowed(path, ctx.permissions.filesystem.read, ctx.installPath);

    await logAudit({
      operation: "fs.read",
      path,
      allowed,
    });

    if (!allowed) {
      throw new UseAgentsError(
        `Read access denied for path: ${path}`,
        "filesystem_denied"
      );
    }
    const content = await readFile(normalizePath(path, ctx.installPath), "utf-8");
    return { content };
  },

  "fs.writeText": async (input: unknown, ctx: ToolContext) => {
    const { path, content } = input as { path: string; content: string };
    const allowed = checkPathAllowed(path, ctx.permissions.filesystem.write, ctx.installPath);

    await logAudit({
      operation: "fs.write",
      path,
      allowed,
      details: { size: content.length },
    });

    if (!allowed) {
      throw new UseAgentsError(
        `Write access denied for path: ${path}`,
        "filesystem_denied"
      );
    }
    await writeFile(normalizePath(path, ctx.installPath), content, "utf-8");
    return { success: true };
  },
};

export function createToolRegistry(
  permissions: Manifest["permissions"],
  allowedTools: string[],
  installPath: string,
  sandboxMode = false
): Record<string, (input: unknown) => Promise<unknown>> {
  const toolContext: ToolContext = {
    permissions,
    secrets: new Set(permissions.secrets),
    installPath,
  };

  const registry: Record<string, (input: unknown) => Promise<unknown>> = {};

  const sandboxConfig = permissions.sandbox;
  const sandboxAllowedTools = sandboxConfig?.tools ?? [];

  for (const toolName of allowedTools) {
    const tool = builtInTools[toolName as keyof typeof builtInTools];
    if (!tool) {
      throw new UseAgentsError(`Unknown tool: ${toolName}`, "unknown_tool", { tool: toolName });
    }

    if (sandboxMode && sandboxConfig?.enabled) {
      if (!sandboxAllowedTools.includes(toolName)) {
        registry[toolName] = () =>
          Promise.reject(
            new UseAgentsError(
              `Tool "${toolName}" is not allowed in sandbox mode`,
              "sandbox_tool_denied"
            )
          );
        continue;
      }
    }

    registry[toolName] = (input: unknown) => tool(input, toolContext);
  }

  return registry;
}
