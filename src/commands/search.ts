import { getRegistryUrl } from "../registry.js";
import { UseAgentsError } from "../utils/errors.js";
import { section } from "../utils/cli.js";

type RegistryType = "direct-agent" | "managed-integration";
type SearchTypeOption = "agent" | "integration";

interface SearchResult {
  name: string;
  type?: RegistryType;
  description: string;
  latestVersion: string;
  author: string;
}

interface SearchOptions {
  type?: string;
  page?: string;
  limit?: string;
}

interface SearchResponse {
  results: SearchResult[];
  total: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

export async function searchCommand(query = "", options: SearchOptions = {}): Promise<void> {
  const registryUrl = getRegistryUrl();
  const normalizedQuery = query.trim();
  const type = normalizeTypeOption(options.type);
  const page = parsePositiveInteger(options.page ?? "1", "page");
  const limit = parsePositiveInteger(options.limit ?? "10", "limit");
  const url = buildSearchUrl(registryUrl, normalizedQuery, type, page, limit);

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`Registry search failed: ${res.status}`);
      return;
    }
    const data = await res.json() as SearchResponse;

    if (data.total === 0) {
      console.log("No matches found.");
      return;
    }

    section(formatTitle(normalizedQuery, type));
    console.log();
    for (const [index, agent] of data.results.entries()) {
      printSearchResult(agent);
      if (index < data.results.length - 1) {
        console.log();
      }
    }
    printPagination(data, normalizedQuery, type);
  } catch {
    console.error("Registry unreachable. Use local path or git URL instead.");
  }
}

function printSearchResult(agent: SearchResult): void {
  const isManaged = agent.type === "managed-integration";
  const type = isManaged ? "managed integration" : "direct agent";
  const header = isManaged
    ? `${agent.name.padEnd(18)} ${type}`
    : `${agent.name.padEnd(18)} ${agent.latestVersion.padEnd(8)} ${type}`;
  console.log(header);
  for (const line of wrapText(agent.description, 78)) {
    console.log(`  ${line}`);
  }
  console.log(`  agent install ${agent.name}`);
}

function buildSearchUrl(
  registryUrl: string,
  query: string,
  type: SearchTypeOption | undefined,
  page: number,
  limit: number
): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (type) params.set("type", type);
  params.set("page", String(page));
  params.set("limit", String(limit));
  return `${registryUrl}/search?${params.toString()}`;
}

function normalizeTypeOption(type: string | undefined): SearchTypeOption | undefined {
  if (!type) return undefined;
  const normalized = type.trim().toLowerCase();
  if (["agent", "agents", "direct", "direct-agent"].includes(normalized)) return "agent";
  if (["integration", "integrations", "managed", "managed-integration"].includes(normalized)) return "integration";
  throw new UseAgentsError("Invalid search type. Use 'agent' or 'integration'.", "invalid_search_type", { type });
}

function parsePositiveInteger(value: string, name: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new UseAgentsError(`${name} must be a positive integer`, "invalid_search_pagination", { [name]: value });
  }
  return parsed;
}

function formatTitle(query: string, type: SearchTypeOption | undefined): string {
  const typeLabel = type === "agent" ? "direct agents" : type === "integration" ? "managed integrations" : "registry entries";
  return query ? `Search results for "${query}" (${typeLabel})` : `Registry ${typeLabel}`;
}

function printPagination(data: SearchResponse, query: string, type: SearchTypeOption | undefined): void {
  const page = data.page ?? 1;
  const limit = data.limit ?? data.results.length;
  const totalPages = data.totalPages ?? Math.max(1, Math.ceil(data.total / Math.max(limit, 1)));
  const start = data.results.length === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(page * limit, data.total);

  console.log(`\nShowing ${start}-${end} of ${data.total} match${data.total === 1 ? "" : "es"} (page ${page} of ${totalPages})`);
  if (page < totalPages) {
    console.log(`Next: ${formatSearchCommand(query, type, page + 1, limit)}`);
  }
  if (page > 1) {
    console.log(`Prev: ${formatSearchCommand(query, type, page - 1, limit)}`);
  }
}

function formatSearchCommand(
  query: string,
  type: SearchTypeOption | undefined,
  page: number,
  limit: number
): string {
  const parts = ["agent search"];
  if (query) {
    parts.push(JSON.stringify(query));
  }
  if (type) {
    parts.push(`--type ${type}`);
  }
  parts.push(`--page ${page}`);
  parts.push(`--limit ${limit}`);
  return parts.join(" ");
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
