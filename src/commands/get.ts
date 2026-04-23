import { getRegistryUrl } from "../registry.js";
import { printKeyValues, printTable, section } from "../utils/cli.js";

export async function getCommand(agentName: string): Promise<void> {
  const registryUrl = getRegistryUrl();
  const url = `${registryUrl}/agents/${agentName}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 404) {
        section(agentName);
        console.log(`Not found in registry.`);
        return;
      }
      console.error(`Registry error: ${res.status}`);
      return;
    }

    const data = await res.json() as {
      name: string;
      type?: string;
      description: string;
      author: string;
      latest: string;
      versions: Record<string, { publishedAt: string; tarballUrl?: string; wrapperUrl?: string }>;
    };

    const isManaged = data.type === "managed-integration";

    section(data.name);
    console.log(`${data.description}`);
    console.log();
    printKeyValues([
      ["Type", isManaged ? "managed integration" : "direct agent"],
      ["Author", data.author],
      ["Latest", data.latest],
      ["Registry", url],
      ["Page", `https://useagents.io/agents/${data.name}`],
    ]);

    const versionRows = Object.keys(data.versions).sort().map((version) => ({
      version,
      published: data.versions[version].publishedAt?.split("T")[0] ?? "unknown",
      artifact: data.versions[version].wrapperUrl ? "wrapper" : data.versions[version].tarballUrl ? "tarball" : "manifest",
    }));
    if (versionRows.length > 0) {
      console.log("\n==> Versions");
      printTable(versionRows, [
        { header: "Version", value: (row) => row.version },
        { header: "Published", value: (row) => row.published },
        { header: "Artifact", value: (row) => row.artifact },
      ]);
    }
  } catch {
    console.error("Registry unreachable.");
  }
}
