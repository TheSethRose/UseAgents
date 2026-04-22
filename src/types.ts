import { z } from "zod";

export const manifestSchema = z.object({
  name: z.string().regex(/^[a-z0-9-]+$/, "Name must be kebab-case"),
  version: z.string().regex(/^\d+\.\d+\.\d+/, "Version must be semver"),
  description: z.string().min(1),
  runtime: z.object({
    type: z.literal("javascript"),
    entrypoint: z.string(),
  }),
  model: z
    .object({
      provider: z.string(),
      model: z.string(),
    })
    .optional(),
  inputs: z.record(z.unknown()).optional(),
  outputs: z.record(z.unknown()).optional(),
  permissions: z.object({
    network: z.union([
      z.boolean().default(false),
      z.object({
        enabled: z.boolean().default(false),
        domains: z.array(z.string()).default([]),
      }),
    ]).default(false),
    filesystem: z
      .object({
        read: z.array(z.string()).default([]),
        write: z.array(z.string()).default([]),
      })
      .default({ read: [], write: [] }),
    secrets: z.array(z.string()).default([]),
    sandbox: z
      .object({
        enabled: z.boolean().default(false),
        tools: z.array(z.string()).default([]),
      })
      .optional(),
  }),
  tools: z.array(z.string()).default([]),
});

export type Manifest = z.infer<typeof manifestSchema>;

export interface AgentContext {
  agent: {
    name: string;
    version: string;
    installPath: string;
  };
  model: {
    generate: (args: {
      system?: string;
      prompt: string;
      temperature?: number;
      responseFormat?: "text" | "json";
    }) => Promise<{ text: string; usage?: unknown }>;
  };
  tools: Record<string, (input: unknown) => Promise<unknown>>;
  secrets: {
    get: (key: string) => string | undefined;
  };
  logger: {
    info: (msg: string, data?: unknown) => void;
    error: (msg: string, data?: unknown) => void;
  };
}

export type AgentRun = (
  input: unknown,
  ctx: AgentContext
) => Promise<unknown>;

export interface ModelAdapter {
  generate(args: {
    model: string;
    apiKey: string;
    system?: string;
    prompt: string;
    temperature?: number;
    responseFormat?: "text" | "json";
  }): Promise<{ text: string; usage?: unknown }>;
}

export interface ToolDefinition {
  name: string;
  handler: (input: unknown, context: ToolContext) => Promise<unknown>;
}

export interface ToolContext {
  permissions: Manifest["permissions"];
  secrets: Set<string>;
  installPath: string;
}

export interface InstallRecord {
  name: string;
  version: string;
  source: string;
  installedAt: string;
  active: boolean;
}

export interface LogEntry {
  timestamp: string;
  agentName: string;
  version: string;
  input: unknown;
  output: unknown;
  status: "success" | "error";
  durationMs: number;
  error?: string;
}

export interface AuditLogEntry {
  timestamp: string;
  agentName: string;
  operation: "fs.read" | "fs.write" | "network.fetch" | "tool.call";
  tool?: string;
  path?: string;
  url?: string;
  allowed: boolean;
  details?: Record<string, unknown>;
}

export interface PermissionRecord {
  agentName: string;
  grantedAt: string;
  permissions: {
    network: boolean;
    filesystem: { read: string[]; write: string[] };
    secrets: string[];
    tools: string[];
  };
}

export interface CliError {
  error: string;
  type: string;
  details?: Record<string, unknown>;
}

export type ManagedIntegrationKind = "managed-external";

export type IntegrationAction =
  | "status"
  | "install"
  | "update"
  | "onboard"
  | "dashboard"
  | "uninstall";

export interface ManagedIntegrationRecord {
  name: string;
  kind: ManagedIntegrationKind;
  wrapperVersion: string;
  installedAt?: string;
  updatedAt?: string;
  upstream: {
    installed: boolean;
    version?: string;
    binaryPath?: string;
    installMethod?: string;
    lastCheckedAt?: string;
  };
}

export interface IntegrationStore {
  integrations: Record<string, ManagedIntegrationRecord>;
}

export interface IntegrationActionResult {
  status: string;
  summary: string;
  version?: string;
  previousVersion?: string;
  binaryPath?: string;
  commands?: string[];
  nextSteps?: string[];
  details?: Record<string, unknown>;
}

export interface ManagedIntegration {
  name: string;
  kind: ManagedIntegrationKind;
  wrapperVersion: string;
  install(options?: { force?: boolean }): Promise<IntegrationActionResult>;
  update(options?: { force?: boolean }): Promise<IntegrationActionResult>;
  uninstall(): Promise<IntegrationActionResult>;
  info(): Promise<IntegrationActionResult>;
  runAction(action: IntegrationAction): Promise<IntegrationActionResult>;
}
