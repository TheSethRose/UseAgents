import { readJson, writeJson, PERMISSIONS_FILE } from "./filesystem.js";
import type { Manifest, PermissionRecord } from "../types.js";

interface PermissionsStore {
  agents: Record<string, PermissionRecord>;
}

export async function loadPermissionsStore(): Promise<PermissionsStore> {
  const store = await readJson<PermissionsStore>(PERMISSIONS_FILE);
  return store ?? { agents: {} };
}

export async function savePermissionsStore(store: PermissionsStore): Promise<void> {
  await writeJson(PERMISSIONS_FILE, store);
}

export function hasGrantedPermissions(
  store: PermissionsStore,
  agentName: string,
  manifest: Manifest
): boolean {
  const record = store.agents[agentName];
  if (!record) return false;

  const perms = record.permissions;

  const networkEnabled =
    typeof manifest.permissions.network === "boolean"
      ? manifest.permissions.network
      : manifest.permissions.network.enabled;
  if (perms.network !== networkEnabled) return false;

  const readPaths = manifest.permissions.filesystem.read;
  if (perms.filesystem.read.length !== readPaths.length) return false;
  for (const path of readPaths) {
    if (!perms.filesystem.read.includes(path)) return false;
  }

  const writePaths = manifest.permissions.filesystem.write;
  if (perms.filesystem.write.length !== writePaths.length) return false;
  for (const path of writePaths) {
    if (!perms.filesystem.write.includes(path)) return false;
  }

  if (perms.secrets.length !== manifest.permissions.secrets.length) return false;
  for (const secret of manifest.permissions.secrets) {
    if (!perms.secrets.includes(secret)) return false;
  }

  if (perms.tools.length !== manifest.tools.length) return false;
  for (const tool of manifest.tools) {
    if (!perms.tools.includes(tool)) return false;
  }

  return true;
}

export function formatPermissionSummary(manifest: Manifest): string {
  const lines: string[] = [];

  const networkEnabled =
    typeof manifest.permissions.network === "boolean"
      ? manifest.permissions.network
      : manifest.permissions.network.enabled;

  lines.push(`Network access: ${networkEnabled ? "YES" : "NO"}`);

  const domains =
    typeof manifest.permissions.network === "boolean"
      ? []
      : manifest.permissions.network.domains;
  if (domains.length > 0) {
    lines.push(`Allowed domains: ${domains.join(", ")}`);
  }

  const readPaths = manifest.permissions.filesystem.read;
  if (readPaths.length > 0) {
    lines.push(`File read access:`);
    for (const path of readPaths) {
      lines.push(`  - ${path}`);
    }
  }

  const writePaths = manifest.permissions.filesystem.write;
  if (writePaths.length > 0) {
    lines.push(`File write access:`);
    for (const path of writePaths) {
      lines.push(`  - ${path}`);
    }
  }

  const secrets = manifest.permissions.secrets;
  if (secrets.length > 0) {
    lines.push(`Secrets required: ${secrets.join(", ")}`);
  }

  const tools = manifest.tools;
  if (tools.length > 0) {
    lines.push(`Tools: ${tools.join(", ")}`);
  }

  return lines.join("\n");
}

export async function promptPermissionGrant(
  agentName: string,
  manifest: Manifest
): Promise<boolean> {
  const summary = formatPermissionSummary(manifest);

  console.log(`\nAgent "${agentName}" requests the following permissions:`);
  console.log("─".repeat(50));
  console.log(summary);
  console.log("─".repeat(50));
  console.log("Grant these permissions? (yes/no): ");

  // Read from stdin
  const response = await readStdinLine();
  const granted = response.toLowerCase().trim() === "yes";

  if (granted) {
    const store = await loadPermissionsStore();
    store.agents[agentName] = {
      agentName,
      grantedAt: new Date().toISOString(),
      permissions: {
        network:
          typeof manifest.permissions.network === "boolean"
            ? manifest.permissions.network
            : manifest.permissions.network.enabled,
        filesystem: {
          read: manifest.permissions.filesystem.read,
          write: manifest.permissions.filesystem.write,
        },
        secrets: manifest.permissions.secrets,
        tools: manifest.tools,
      },
    };
    await savePermissionsStore(store);
    console.log("Permissions granted and saved.\n");
  } else {
    console.log("Permissions denied.\n");
  }

  return granted;
}

function readStdinLine(): Promise<string> {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    stdin.setEncoding("utf-8");
    stdin.resume();

    let data = "";
    const onData = (chunk: string) => {
      data += chunk;
      if (data.includes("\n")) {
        stdin.pause();
        stdin.removeListener("data", onData);
        resolve(data.trim());
      }
    };

    stdin.on("data", onData);
  });
}
