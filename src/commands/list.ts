import { readdir } from "node:fs/promises";
import { ACTIVE_DIR } from "../utils/filesystem.js";
import { pathExists } from "../utils/filesystem.js";

export async function listCommand(): Promise<void> {
  if (!await pathExists(ACTIVE_DIR)) {
    console.log("No agents installed.");
    return;
  }
  
  const entries = await readdir(ACTIVE_DIR);
  if (entries.length === 0) {
    console.log("No agents installed.");
    return;
  }
  
  console.log("Installed agents:");
  for (const name of entries) {
    console.log(`  ${name}`);
  }
}
