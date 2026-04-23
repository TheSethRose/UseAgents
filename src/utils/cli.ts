import { basename } from "path";
import { UseAgentsError } from "./errors.js";

export const DEFAULT_USEAGENTS_BIN_NAME = "agent";

function isDirectNodeEntrypoint(invokedName: string): boolean {
  return invokedName.endsWith(".js") || invokedName.endsWith(".mjs") || invokedName.endsWith(".cjs");
}

export function getInvokedCliName(argvEntry: string | undefined): string | null {
  if (!argvEntry) {
    return null;
  }

  const name = basename(argvEntry).trim();
  return name.length > 0 ? name : null;
}

export function assertSafeCliInvocation(argvEntry: string | undefined, allowedBinNames: readonly string[]): void {
  const invokedName = getInvokedCliName(argvEntry);

  if (!invokedName) {
    return;
  }

  if (!isDirectNodeEntrypoint(invokedName) && !allowedBinNames.includes(invokedName)) {
    throw new UseAgentsError(
      `UseAgents must not be invoked as '${invokedName}'. Use one of the declared CLI binaries instead: ${allowedBinNames.join(", ")}.`,
      "invalid_cli_invocation",
      {
        invokedName,
        allowedBinNames: [...allowedBinNames],
      }
    );
  }
}

export interface TableColumn<T> {
  header: string;
  value: (row: T) => string | number | boolean | undefined | null;
  maxWidth?: number;
}

export function section(title: string): void {
  console.log(`==> ${title}`);
}

export function formatValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "unknown";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : "none";
  return String(value);
}

export function printKeyValues(rows: Array<[string, unknown]>): void {
  const width = Math.max(...rows.map(([key]) => key.length), 0);
  for (const [key, value] of rows) {
    console.log(`${key.padEnd(width)}  ${formatValue(value)}`);
  }
}

export function printTable<T>(rows: T[], columns: Array<TableColumn<T>>): void {
  if (rows.length === 0) {
    return;
  }

  const rendered = rows.map((row) =>
    columns.map((column) => truncate(formatValue(column.value(row)), column.maxWidth))
  );
  const widths = columns.map((column, index) =>
    Math.max(column.header.length, ...rendered.map((row) => row[index].length))
  );

  console.log(columns.map((column, index) => column.header.padEnd(widths[index])).join("  "));
  console.log(widths.map((width) => "-".repeat(width)).join("  "));
  for (const row of rendered) {
    console.log(row.map((value, index) => value.padEnd(widths[index])).join("  "));
  }
}

function truncate(value: string, maxWidth: number | undefined): string {
  if (!maxWidth || value.length <= maxWidth) return value;
  if (maxWidth <= 3) return value.slice(0, maxWidth);
  return `${value.slice(0, maxWidth - 3)}...`;
}
