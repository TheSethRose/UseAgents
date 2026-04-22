import { readFile } from "node:fs/promises";
import { join } from "node:path";
import YAML from "yaml";
import { manifestSchema, type Manifest } from "../types.js";
import { UseAgentsError } from "./errors.js";

export async function loadManifest(path: string): Promise<Manifest> {
  const manifestPath = join(path, "agent.yaml");
  let content: string;
  
  try {
    content = await readFile(manifestPath, "utf-8");
  } catch {
    throw new UseAgentsError(
      "Agent manifest not found",
      "manifest_missing",
      { path: manifestPath }
    );
  }

  let parsed: unknown;
  try {
    parsed = YAML.parse(content);
  } catch (e) {
    throw new UseAgentsError(
      "Agent manifest is invalid YAML",
      "manifest_invalid",
      { reason: e instanceof Error ? e.message : String(e) }
    );
  }

  const result = manifestSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new UseAgentsError(
      "Agent manifest invalid",
      "manifest_invalid",
      { issues }
    );
  }

  return result.data;
}

export function validateEntrypoint(manifest: Manifest, basePath: string): void {
  const entrypointPath = join(basePath, manifest.runtime.entrypoint);
}
