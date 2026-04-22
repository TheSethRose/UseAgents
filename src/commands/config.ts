import { USEAGENTS_DIR, STATE_DIR, SECRETS_DIR, CACHE_DIR } from "../utils/filesystem.js";
import { getRegistryUrl } from "../registry.js";

export async function configCommand(): Promise<void> {
  console.log("==> Configuration");
  console.log(`HOMEBREW_PREFIX: ${USEAGENTS_DIR}`);
  console.log(`HOMEBREW_CELLAR: ${CACHE_DIR}`);
  console.log(`HOMEBREW_REPOSITORY: ${USEAGENTS_DIR}`);
  console.log(`HOMEBREW_STATE: ${STATE_DIR}`);
  console.log(`HOMEBREW_SECRETS: ${SECRETS_DIR}`);
  console.log(`Registry URL: ${getRegistryUrl()}`);

  const envVars = [
    "USEAGENTS_REGISTRY",
    "USEAGENTS_REGISTRY_CACHE_TTL",
    "USEAGENTS_OFFLINE",
  ];

  console.log("\n==> Environment");
  for (const key of envVars) {
    const value = process.env[key];
    if (value) {
      console.log(`${key}: ${value}`);
    }
  }
}
