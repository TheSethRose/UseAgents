import { pathExists } from "../utils/filesystem.js";
import { loadManifest } from "../utils/manifest.js";
import { UseAgentsError } from "../utils/errors.js";

export async function validateCommand(path: string): Promise<void> {
  if (!await pathExists(path)) {
    throw new UseAgentsError("Path does not exist", "path_not_found", { path });
  }
  
  try {
    const manifest = await loadManifest(path);
    console.log(`✓ Manifest is valid`);
    console.log(`  Name: ${manifest.name}`);
    console.log(`  Version: ${manifest.version}`);
    console.log(`  Description: ${manifest.description}`);
    console.log(`  Runtime: ${manifest.runtime.type}`);
    console.log(`  Entrypoint: ${manifest.runtime.entrypoint}`);
    
    if (manifest.model) {
      console.log(`  Model: ${manifest.model.provider}/${manifest.model.model}`);
    }
    
    console.log(`  Permissions:`);
    console.log(`    Network: ${manifest.permissions.network ? "yes" : "no"}`);
    console.log(`    Secrets: ${manifest.permissions.secrets.join(", ") || "none"}`);
    console.log(`    Tools: ${manifest.tools.join(", ") || "none"}`);
  } catch (error) {
    if (error instanceof UseAgentsError) {
      throw error;
    }
    throw new UseAgentsError("Validation failed", "validation_failed", {
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}
