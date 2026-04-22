import { join } from "node:path";
import { pathExists, getAgentActivePath, appendJsonl, LOGS_FILE, AUDIT_LOGS_FILE } from "../utils/filesystem.js";
import { UseAgentsError } from "../utils/errors.js";
import type { AgentContext } from "../types.js";
import { createModelAdapter } from "../adapters/model.js";
import { createToolRegistry, setAuditLogConfig } from "../adapters/tools.js";
import { loadSecrets } from "./secret.js";
import { Logger } from "../utils/logger.js";
import { loadPermissionsStore, hasGrantedPermissions, promptPermissionGrant } from "../utils/permissions.js";
import { isDockerAvailable, runInSandbox } from "../utils/sandbox.js";
import { isManagedOpenClaw, runOpenClawIntegrationAction } from "../integrations/openclaw.js";

export async function runCommand(agentName: string, options: { input?: string; sandbox?: boolean }): Promise<void> {
  let input: unknown;
  if (options.input) {
    try {
      input = JSON.parse(options.input);
    } catch {
      throw new UseAgentsError("Invalid JSON input", "invalid_input", { input: options.input });
    }
  }

  if (isManagedOpenClaw(agentName)) {
    const result = await runOpenClawIntegrationAction(input);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const activePath = getAgentActivePath(agentName);
  
  if (!await pathExists(activePath)) {
    throw new UseAgentsError("Agent not found", "agent_not_found", { name: agentName });
  }
  
  const manifestPath = join(activePath, "agent.yaml");
  if (!await pathExists(manifestPath)) {
    throw new UseAgentsError("Agent manifest missing", "manifest_missing", { path: activePath });
  }
  
  const { loadManifest } = await import("../utils/manifest.js");
  const manifest = await loadManifest(activePath);

  const permissionsStore = await loadPermissionsStore();
  if (!hasGrantedPermissions(permissionsStore, agentName, manifest)) {
    const granted = await promptPermissionGrant(agentName, manifest);
    if (!granted) {
      throw new UseAgentsError("Permission denied by user", "permission_denied");
    }
  }

  const entrypointPath = join(activePath, manifest.runtime.entrypoint);
  if (!await pathExists(entrypointPath)) {
    throw new UseAgentsError(
      "Agent entrypoint not found",
      "entrypoint_missing",
      { entrypoint: manifest.runtime.entrypoint }
    );
  }
  
  const secrets = await loadSecrets();
  for (const secretKey of manifest.permissions.secrets) {
    if (!secrets[secretKey]) {
      throw new UseAgentsError(
        `Required secret not set: ${secretKey}`,
        "secret_missing",
        { secret: secretKey }
      );
    }
  }
  
  const startTime = Date.now();
  const logger = new Logger();
  
  const modelAdapter = manifest.model
    ? createModelAdapter(manifest.model.provider, secrets)
    : null;
  
  const sandboxMode = options.sandbox || manifest.permissions.sandbox?.enabled || false;
  if (sandboxMode) {
    console.log("Running in sandbox mode");
  }
  setAuditLogConfig(AUDIT_LOGS_FILE, agentName);

  if (sandboxMode) {
    const dockerAvailable = await isDockerAvailable();
    if (dockerAvailable) {
      try {
        const result = await runInSandbox(activePath, input);
        console.log(JSON.stringify(result, null, 2));
        return;
      } catch (error) {
        if (error instanceof UseAgentsError && error.type === "docker_not_found") {
          console.warn("Docker not available, falling back to local sandbox");
        } else {
          throw error;
        }
      }
    }
  }

  const toolRegistry = createToolRegistry(manifest.permissions, manifest.tools, activePath, sandboxMode);

  const ctx: AgentContext = {
    agent: {
      name: manifest.name,
      version: manifest.version,
      installPath: activePath,
    },
    model: {
      generate: async (args) => {
        if (!modelAdapter) {
          throw new UseAgentsError("No model configured for this agent", "model_not_configured");
        }
        const apiKey = secrets[`${manifest.model!.provider.toUpperCase()}_API_KEY`];
        if (!apiKey) {
          throw new UseAgentsError("Model API key not found", "api_key_missing");
        }
        return modelAdapter.generate({
          model: manifest.model!.model,
          apiKey,
          ...args,
        });
      },
    },
    tools: toolRegistry,
    secrets: {
      get: (key: string) => {
        if (!manifest.permissions.secrets.includes(key)) {
          return undefined;
        }
        return secrets[key];
      },
    },
    logger: {
      info: (msg, data) => logger.info(msg, data),
      error: (msg, data) => logger.error(msg, data),
    },
  };
  
  try {
    const agentModule = await import(entrypointPath);
    if (typeof agentModule.run !== "function") {
      throw new UseAgentsError(
        "Agent entrypoint must export a run() function",
        "invalid_entrypoint"
      );
    }
    
    const result = await agentModule.run(input, ctx);
    const duration = Date.now() - startTime;
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      agentName: manifest.name,
      version: manifest.version,
      input,
      output: result,
      status: "success" as const,
      durationMs: duration,
    };
    
    await appendJsonl(LOGS_FILE, logEntry);
    
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    const duration = Date.now() - startTime;
    const logEntry = {
      timestamp: new Date().toISOString(),
      agentName: manifest.name,
      version: manifest.version,
      input,
      output: null,
      status: "error" as const,
      durationMs: duration,
      error: error instanceof Error ? error.message : String(error),
    };
    
    await appendJsonl(LOGS_FILE, logEntry);
    throw error;
  }
}
