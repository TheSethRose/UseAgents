import { USEAGENTS_DIR, STATE_DIR, SECRETS_DIR, CACHE_DIR } from "../utils/filesystem.js";
import { getRegistryUrl } from "../registry.js";

export async function configCommand(): Promise<void> {
  console.log("==> Configuration");
  console.log(`USEAGENTS_HOME: ${USEAGENTS_DIR}`);
  console.log(`USEAGENTS_CACHE: ${CACHE_DIR}`);
  console.log(`USEAGENTS_STATE: ${STATE_DIR}`);
  console.log(`USEAGENTS_SECRETS: ${SECRETS_DIR}`);
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
