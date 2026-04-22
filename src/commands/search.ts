import { getRegistryUrl } from "../registry.js";

export async function searchCommand(query: string): Promise<void> {
  const registryUrl = getRegistryUrl();
  const url = `${registryUrl}/search?q=${encodeURIComponent(query)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`Registry search failed: ${res.status}`);
      return;
    }
    const data = await res.json() as { results: Array<{ name: string; description: string; latestVersion: string; author: string }>; total: number };

    if (data.total === 0) {
      console.log("No matches found.");
      return;
    }

    console.log(`==> Results`);
    for (const agent of data.results) {
      console.log(`${agent.name}  ${agent.description}`);
      console.log(`  https://useagents.io/agents/${agent.name}`);
    }
    console.log(`\n==> ${data.total} match${data.total === 1 ? "" : "es"}`);
  } catch {
    console.error("Registry unreachable. Use local path or git URL instead.");
  }
}
