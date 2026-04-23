import { getRegistryUrl } from "../registry.js";
import { printTable, section } from "../utils/cli.js";

export async function searchCommand(query: string): Promise<void> {
  const registryUrl = getRegistryUrl();
  const url = `${registryUrl}/search?q=${encodeURIComponent(query)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`Registry search failed: ${res.status}`);
      return;
    }
    const data = await res.json() as { results: Array<{ name: string; type?: string; description: string; latestVersion: string; author: string }>; total: number };

    if (data.total === 0) {
      console.log("No matches found.");
      return;
    }

    section(`Search results for "${query}"`);
    printTable(data.results, [
      { header: "Name", value: (agent) => agent.name },
      { header: "Type", value: (agent) => agent.type === "managed-integration" ? "managed" : "direct" },
      { header: "Version", value: (agent) => agent.latestVersion },
      { header: "Description", value: (agent) => agent.description, maxWidth: 84 },
    ]);
    console.log(`\n${data.total} match${data.total === 1 ? "" : "es"}`);
  } catch {
    console.error("Registry unreachable. Use local path or git URL instead.");
  }
}
