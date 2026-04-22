import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Manifest, ToolContext } from "../types.js";
import { UseAgentsError } from "../utils/errors.js";

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
    if (normalized.startsWith(normalizedAllowed)) {
      return true;
    }
  }
  return false;
}

const builtInTools = {
  "echo.text": async (input: unknown, _ctx: ToolContext) => {
    const { text } = input as { text: string };
    return { text };
  },
  
  "http.fetch": async (input: unknown, ctx: ToolContext) => {
    if (!ctx.permissions.network) {
      throw new UseAgentsError("Network access not permitted", "network_denied");
    }
    const { url, method = "GET", headers, body } = input as {
      url: string;
      method?: string;
      headers?: Record<string, string>;
      body?: string;
    };
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
    if (!checkPathAllowed(path, ctx.permissions.filesystem.read, ctx.installPath)) {
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
    if (!checkPathAllowed(path, ctx.permissions.filesystem.write, ctx.installPath)) {
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
  installPath: string
): Record<string, (input: unknown) => Promise<unknown>> {
  const toolContext: ToolContext = {
    permissions,
    secrets: new Set(permissions.secrets),
    installPath,
  };
  
  const registry: Record<string, (input: unknown) => Promise<unknown>> = {};
  
  for (const toolName of allowedTools) {
    const tool = builtInTools[toolName as keyof typeof builtInTools];
    if (!tool) {
      throw new UseAgentsError(`Unknown tool: ${toolName}`, "unknown_tool", { tool: toolName });
    }
    registry[toolName] = (input: unknown) => tool(input, toolContext);
  }
  
  return registry;
}
