import { getRegistryPackageUrl } from "../registry.js";
import { printKeyValues, printTable, section } from "../utils/cli.js";

export async function getCommand(agentName: string): Promise<void> {
  const url = getRegistryPackageUrl(agentName);

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
      status?: string;
      versions: Record<string, { publishedAt: string; tarballUrl?: string; wrapperUrl?: string; status?: string; artifactSha256?: string }>;
    };

    const isManaged = data.type === "managed-integration";

    section(data.name);
    console.log(`${data.description}`);
    console.log();
    printKeyValues([
      ["Type", isManaged ? "managed integration" : "direct agent"],
      ["Author", data.author],
      ["Status", data.status ?? "active"],
      ...(!isManaged ? [["Latest", data.latest] as [string, unknown]] : []),
      ["Registry", url],
      ["Page", `https://useagents.io/agents/${data.name}`],
    ]);

    const versionRows = Object.keys(data.versions).sort().map((version) => ({
      version,
      published: data.versions[version].publishedAt?.split("T")[0] ?? "unknown",
      status: data.versions[version].status ?? "active",
      artifact: data.versions[version].wrapperUrl ? "wrapper" : data.versions[version].tarballUrl ? "tarball" : "manifest",
    }));
    if (!isManaged && versionRows.length > 0) {
      console.log("\n==> Versions");
      printTable(versionRows, [
        { header: "Version", value: (row) => row.version },
        { header: "Status", value: (row) => row.status },
        { header: "Published", value: (row) => row.published },
        { header: "Artifact", value: (row) => row.artifact },
      ]);
    }
  } catch {
    console.error("Registry unreachable.");
  }
}
