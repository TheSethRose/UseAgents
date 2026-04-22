import { readJsonl, LOGS_FILE } from "../utils/filesystem.js";
import type { LogEntry } from "../types.js";

export async function logsCommand(agentName?: string): Promise<void> {
  const logs = await readJsonl<LogEntry>(LOGS_FILE);
  
  const filtered = agentName
    ? logs.filter((l) => l.agentName === agentName)
    : logs;
  
  if (filtered.length === 0) {
    console.log(agentName ? `No logs found for ${agentName}.` : "No logs found.");
    return;
  }
  
  console.log(`Recent logs${agentName ? ` for ${agentName}` : ""}:`);
  console.log();
  
  for (const log of filtered.slice(-20)) {
    const status = log.status === "success" ? "✓" : "✗";
    console.log(`${status} ${log.timestamp} ${log.agentName}@${log.version} (${log.durationMs}ms)`);
    if (log.error) {
      console.log(`  Error: ${log.error}`);
    }
  }
}
