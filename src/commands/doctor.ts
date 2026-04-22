import { accessSync } from "node:fs";
import { USEAGENTS_DIR, RUNTIMES_DIR, ACTIVE_DIR, STATE_DIR, SECRETS_DIR, CACHE_DIR } from "../utils/filesystem.js";
import { getRegistryUrl } from "../registry.js";

export async function doctorCommand(): Promise<void> {
  let issues = 0;

  console.log("==> Checking UseAgents installation");

  const checks = [
    { name: "Home directory", path: USEAGENTS_DIR },
    { name: "Runtimes directory", path: RUNTIMES_DIR },
    { name: "Active directory", path: ACTIVE_DIR },
    { name: "State directory", path: STATE_DIR },
    { name: "Secrets directory", path: SECRETS_DIR },
    { name: "Cache directory", path: CACHE_DIR },
  ];

  for (const check of checks) {
    try {
      accessSync(check.path);
      console.log(`  ${check.name}: OK`);
    } catch {
      console.log(`  ${check.name}: MISSING (${check.path})`);
      issues++;
    }
  }

  console.log(`\n==> Checking registry connectivity`);
  const registryUrl = getRegistryUrl();
  try {
    const res = await fetch(`${registryUrl}/agents`, { method: "HEAD" });
    console.log(`  Registry (${registryUrl}): OK (${res.status})`);
  } catch {
    console.log(`  Registry (${registryUrl}): UNREACHABLE`);
    issues++;
  }

  console.log(`\n==> Checking Node.js version`);
  const nodeVersion = process.version;
  const major = parseInt(nodeVersion.slice(1).split(".")[0], 10);
  if (major >= 20) {
    console.log(`  Node.js ${nodeVersion}: OK`);
  } else {
    console.log(`  Node.js ${nodeVersion}: OUTDATED (requires >= 20)`);
    issues++;
  }

  if (issues === 0) {
    console.log("\n==> No issues found");
  } else {
    console.log(`\n==> ${issues} issue${issues === 1 ? "" : "s"} found`);
    process.exit(1);
  }
}
