import { getRegistryUrl } from "../registry.js";
import { section } from "../utils/cli.js";

interface SearchResult {
  name: string;
  type?: string;
  description: string;
  latestVersion: string;
  author: string;
}

export async function searchCommand(query: string): Promise<void> {
  const registryUrl = getRegistryUrl();
  const url = `${registryUrl}/search?q=${encodeURIComponent(query)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`Registry search failed: ${res.status}`);
      return;
    }
    const data = await res.json() as { results: SearchResult[]; total: number };

    if (data.total === 0) {
      console.log("No matches found.");
      return;
    }

    section(`Search results for "${query}"`);
    console.log();
    for (const [index, agent] of data.results.entries()) {
      printSearchResult(agent);
      if (index < data.results.length - 1) {
        console.log();
      }
    }
    console.log(`\n${data.total} match${data.total === 1 ? "" : "es"}`);
  } catch {
    console.error("Registry unreachable. Use local path or git URL instead.");
  }
}

function printSearchResult(agent: SearchResult): void {
  const type = agent.type === "managed-integration" ? "managed integration" : "direct agent";
  console.log(`${agent.name.padEnd(18)} ${agent.latestVersion.padEnd(8)} ${type}`);
  for (const line of wrapText(agent.description, 78)) {
    console.log(`  ${line}`);
  }
  console.log(`  agent install ${agent.name}`);
}

function wrapText(text: string, width: number): string[] {
  const maxWidth = Math.max(48, Math.min(width, (process.stdout.columns ?? 100) - 4));
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    if (line.length === 0) {
      line = word;
    } else if (line.length + word.length + 1 <= maxWidth) {
      line += ` ${word}`;
    } else {
      lines.push(line);
      line = word;
    }
  }

  if (line.length > 0) {
    lines.push(line);
  }

  return lines.length > 0 ? lines : [""];
}
