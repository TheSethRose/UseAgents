import { spawnSync } from "node:child_process";
import packageJson from "../../package.json";
import type { IntegrationsState, ManagedIntegrationRecord, ManagedIntegrationUpstreamState } from "../types.js";
import { UseAgentsError } from "../utils/errors.js";
import { INTEGRATIONS_FILE, readJson, writeJson } from "../utils/filesystem.js";

export const OPENCLAW_NAME = "openclaw";
export const OPENCLAW_KIND = "managed-external" as const;
export const OPENCLAW_INSTALL_URL = "https://openclaw.ai/install.sh";
export const OPENCLAW_INSTALL_COMMAND = `curl -fsSL ${OPENCLAW_INSTALL_URL} | bash -s -- --no-onboard`;
export const OPENCLAW_UPDATE_COMMAND = "openclaw update";
export const OPENCLAW_ONBOARD_COMMAND = "openclaw onboard --install-daemon";
export const OPENCLAW_STATUS_COMMAND = "openclaw status";
export const OPENCLAW_DASHBOARD_COMMAND = "openclaw dashboard";
export const OPENCLAW_UNINSTALL_COMMAND = "openclaw uninstall --all --yes --non-interactive";
export const OPENCLAW_SUPPORTED_ACTIONS = ["status", "install", "update", "onboard", "dashboard", "uninstall"] as const;

type OpenClawAction = (typeof OPENCLAW_SUPPORTED_ACTIONS)[number];

function nowIso(): string {
  return new Date().toISOString();
}

function emptyIntegrationsState(): IntegrationsState {
  return { integrations: {} };
}

async function loadIntegrationsState(): Promise<IntegrationsState> {
  return (await readJson<IntegrationsState>(INTEGRATIONS_FILE)) ?? emptyIntegrationsState();
}

async function saveIntegrationsState(state: IntegrationsState): Promise<void> {
  await writeJson(INTEGRATIONS_FILE, state);
}

export function isManagedOpenClaw(name: string): boolean {
  return name === OPENCLAW_NAME;
}

function runCapture(command: string, args: string[]): ReturnType<typeof spawnSync> {
  return spawnSync(command, args, { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });
}

function runInteractive(command: string, args: string[]): ReturnType<typeof spawnSync> {
  return spawnSync(command, args, { stdio: "inherit" });
}

function runShell(command: string): ReturnType<typeof spawnSync> {
  if (process.platform === "win32") {
    return spawnSync("powershell", ["-Command", command], { stdio: "inherit" });
  }
  return spawnSync("bash", ["-lc", command], { stdio: "inherit" });
}

function resolveBinaryPath(commandName: string): string | null {
  const result = process.platform === "win32"
    ? runCapture("where", [commandName])
    : runCapture("bash", ["-lc", `command -v ${commandName}`]);

  if (result.status !== 0) {
    return null;
  }

  const output = `${result.stdout || ""}`.trim();
  return output ? output.split(/\r?\n/)[0] : null;
}

function readOpenClawVersion(): string | null {
  const result = runCapture("openclaw", ["--version"]);
  if (result.status !== 0) {
    return null;
  }

  const output = `${result.stdout || result.stderr || ""}`.trim();
  return output || null;
}

export function detectOpenClawUpstreamState(): ManagedIntegrationUpstreamState {
  const binaryPath = resolveBinaryPath(OPENCLAW_NAME);
  const version = binaryPath ? readOpenClawVersion() : null;

  return {
    installed: Boolean(binaryPath),
    version,
    binaryPath,
    installMethod: "official-installer",
    lastCheckedAt: nowIso(),
  };
}

async function upsertOpenClawRecord(upstream: ManagedIntegrationUpstreamState): Promise<ManagedIntegrationRecord> {
  const state = await loadIntegrationsState();
  const existing = state.integrations[OPENCLAW_NAME];
  const timestamp = nowIso();

  const record: ManagedIntegrationRecord = {
    name: OPENCLAW_NAME,
    kind: OPENCLAW_KIND,
    wrapperVersion: packageJson.version,
    installedAt: existing?.installedAt ?? timestamp,
    updatedAt: timestamp,
    upstream,
  };

  state.integrations[OPENCLAW_NAME] = record;
  await saveIntegrationsState(state);
  return record;
}

async function removeOpenClawRecord(): Promise<void> {
  const state = await loadIntegrationsState();
  delete state.integrations[OPENCLAW_NAME];
  await saveIntegrationsState(state);
}

export async function getOpenClawRecord(): Promise<ManagedIntegrationRecord | undefined> {
  const state = await loadIntegrationsState();
  return state.integrations[OPENCLAW_NAME];
}

function ensureCommandSucceeded(result: ReturnType<typeof spawnSync>, failureMessage: string): void {
  if (result.error || result.status !== 0) {
    throw new UseAgentsError(failureMessage, "integration_command_failed", {
      error: result.error?.message,
      exitCode: result.status ?? null,
    });
  }
}

function assertSupportedAction(action: string): asserts action is OpenClawAction {
  if (!OPENCLAW_SUPPORTED_ACTIONS.includes(action as OpenClawAction)) {
    throw new UseAgentsError("Unsupported openclaw action", "invalid_input", {
      action,
      supportedActions: [...OPENCLAW_SUPPORTED_ACTIONS],
    });
  }
}

export async function installOpenClawIntegration(): Promise<ManagedIntegrationRecord> {
  let upstream = detectOpenClawUpstreamState();

  if (!upstream.installed) {
    if (process.platform === "win32") {
      throw new UseAgentsError(
        "Automatic OpenClaw install is not wired up on Windows yet. Use the official OpenClaw install docs.",
        "platform_not_supported",
        { docs: "https://docs.openclaw.ai/install" }
      );
    }

    const installResult = runShell(OPENCLAW_INSTALL_COMMAND);
    ensureCommandSucceeded(installResult, "Failed to install OpenClaw via the official installer");
    upstream = detectOpenClawUpstreamState();
  }

  if (!upstream.installed) {
    throw new UseAgentsError("OpenClaw installation could not be verified", "integration_install_failed");
  }

  const record = await upsertOpenClawRecord(upstream);

  console.log(`Registered integration: ${record.name}`);
  console.log(`Integration type: ${record.kind}`);
  console.log(`Wrapper version: ${record.wrapperVersion}`);
  console.log(`Upstream installed: yes`);
  console.log(`Upstream version: ${record.upstream.version ?? "unknown"}`);
  console.log(`Binary path: ${record.upstream.binaryPath ?? "unknown"}`);
  console.log(`Install method: ${record.upstream.installMethod}`);

  return record;
}

export async function updateOpenClawIntegration(): Promise<{ before: ManagedIntegrationUpstreamState; after: ManagedIntegrationRecord; }> {
  const before = detectOpenClawUpstreamState();

  if (before.installed) {
    const updateResult = runInteractive("openclaw", ["update"]);
    ensureCommandSucceeded(updateResult, "Failed to update OpenClaw using the official update flow");
  } else {
    if (process.platform === "win32") {
      throw new UseAgentsError(
        "OpenClaw is not installed and automatic install is not wired up on Windows yet.",
        "platform_not_supported",
        { docs: "https://docs.openclaw.ai/install" }
      );
    }

    const installResult = runShell(OPENCLAW_INSTALL_COMMAND);
    ensureCommandSucceeded(installResult, "Failed to install OpenClaw via the official installer");
  }

  const after = await upsertOpenClawRecord(detectOpenClawUpstreamState());

  console.log(`Updated integration: ${OPENCLAW_NAME}`);
  console.log(`Before: ${before.version ?? (before.installed ? "unknown" : "not installed")}`);
  console.log(`After: ${after.upstream.version ?? "unknown"}`);

  return { before, after };
}

export async function removeOpenClawIntegration(options: { uninstallUpstream?: boolean } = {}): Promise<void> {
  const upstream = detectOpenClawUpstreamState();

  if (options.uninstallUpstream && upstream.installed) {
    const uninstallResult = runInteractive("openclaw", ["uninstall", "--all", "--yes", "--non-interactive"]);
    ensureCommandSucceeded(uninstallResult, "Failed to uninstall upstream OpenClaw");
  }

  await removeOpenClawRecord();
  console.log(
    options.uninstallUpstream
      ? "Removed OpenClaw integration state and requested upstream uninstall."
      : "Removed OpenClaw integration state. Upstream OpenClaw was left installed."
  );
}

export async function infoOpenClawIntegration(): Promise<void> {
  const record = await getOpenClawRecord();
  const upstream = detectOpenClawUpstreamState();

  console.log(`Integration name: ${OPENCLAW_NAME}`);
  console.log(`Integration type: ${OPENCLAW_KIND}`);
  console.log(`Wrapper installed: ${record ? "yes" : "no"}`);
  console.log(`Wrapper version: ${record?.wrapperVersion ?? packageJson.version}`);
  console.log(`Upstream installed: ${upstream.installed ? "yes" : "no"}`);
  console.log(`Upstream version: ${upstream.version ?? "unknown"}`);
  console.log(`Binary path: ${upstream.binaryPath ?? "not found"}`);
  console.log(`Install method: ${upstream.installMethod}`);
  console.log(`Last checked: ${upstream.lastCheckedAt}`);
  if (record) {
    console.log(`Wrapper installed at: ${record.installedAt}`);
    console.log(`Wrapper updated at: ${record.updatedAt}`);
  }
  console.log(`Supported actions: ${OPENCLAW_SUPPORTED_ACTIONS.join(", ")}`);
}

export async function runOpenClawIntegrationAction(actionInput: unknown): Promise<Record<string, unknown>> {
  const action = typeof actionInput === "object" && actionInput && typeof (actionInput as { action?: unknown }).action === "string"
    ? (actionInput as { action: string }).action
    : "status";

  assertSupportedAction(action);

  switch (action) {
    case "status": {
      const upstream = detectOpenClawUpstreamState();
      return {
        integration: OPENCLAW_NAME,
        type: OPENCLAW_KIND,
        action,
        upstreamInstalled: upstream.installed,
        upstreamVersion: upstream.version,
        binaryPath: upstream.binaryPath,
        installMethod: upstream.installMethod,
        lastCheckedAt: upstream.lastCheckedAt,
      };
    }
    case "install": {
      const record = await installOpenClawIntegration();
      return {
        integration: OPENCLAW_NAME,
        type: OPENCLAW_KIND,
        action,
        wrapperVersion: record.wrapperVersion,
        upstream: record.upstream,
      };
    }
    case "update": {
      const { before, after } = await updateOpenClawIntegration();
      return {
        integration: OPENCLAW_NAME,
        type: OPENCLAW_KIND,
        action,
        before,
        after: after.upstream,
      };
    }
    case "onboard": {
      const result = runInteractive("openclaw", ["onboard", "--install-daemon"]);
      ensureCommandSucceeded(result, "Failed to run OpenClaw onboarding");
      return {
        integration: OPENCLAW_NAME,
        type: OPENCLAW_KIND,
        action,
        status: "completed",
      };
    }
    case "dashboard": {
      const result = runInteractive("openclaw", ["dashboard"]);
      ensureCommandSucceeded(result, "Failed to open the OpenClaw dashboard");
      return {
        integration: OPENCLAW_NAME,
        type: OPENCLAW_KIND,
        action,
        status: "completed",
      };
    }
    case "uninstall": {
      await removeOpenClawIntegration({ uninstallUpstream: true });
      return {
        integration: OPENCLAW_NAME,
        type: OPENCLAW_KIND,
        action,
        status: "completed",
      };
    }
  }
}