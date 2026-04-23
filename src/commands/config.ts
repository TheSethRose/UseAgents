import { USEAGENTS_DIR, STATE_DIR, SECRETS_DIR, CACHE_DIR } from "../utils/filesystem.js";
import { getRegistryUrl } from "../registry.js";
import { printKeyValues, section } from "../utils/cli.js";

export async function configCommand(): Promise<void> {
  section("Configuration");
  printKeyValues([
    ["Home", USEAGENTS_DIR],
    ["Cache", CACHE_DIR],
    ["State", STATE_DIR],
    ["Secrets", SECRETS_DIR],
    ["Registry", getRegistryUrl()],
  ]);

  const envVars = [
    "USEAGENTS_REGISTRY",
    "USEAGENTS_REGISTRY_CACHE_TTL",
    "USEAGENTS_OFFLINE",
  ];

  console.log("\n==> Environment");
  printKeyValues(envVars.map((key) => [key, process.env[key] ?? "unset"]));
}
