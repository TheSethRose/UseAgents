import { getRegistryUrl } from "../registry.js";

export async function getCommand(agentName: string): Promise<void> {
  const registryUrl = getRegistryUrl();
  const url = `${registryUrl}/agents/${agentName}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 404) {
        console.log(`==> ${agentName}`);
        console.log(`Not found in registry.`);
        return;
      }
      console.error(`Registry error: ${res.status}`);
      return;
    }

    const data = await res.json() as {
      name: string;
      description: string;
      author: string;
      latest: string;
      versions: Record<string, { publishedAt: string }>;
    };

    console.log(`==> ${data.name}`);
    console.log(`${data.description}`);
    console.log(`https://useagents.io/agents/${data.name}`);
    console.log(`Author: ${data.author}`);
    console.log(`Latest: ${data.latest}`);

    const versionKeys = Object.keys(data.versions).sort();
    if (versionKeys.length > 0) {
      console.log(`\nInstalled versions:`);
      for (const v of versionKeys) {
        const published = data.versions[v].publishedAt?.split("T")[0] ?? "unknown";
        console.log(`  ${v} (${published})`);
      }
    }
  } catch {
    console.error("Registry unreachable.");
  }
}
