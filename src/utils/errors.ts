import type { CliError } from "../types.js";

export class UseAgentsError extends Error {
  public type: string;
  public details?: Record<string, unknown>;

  constructor(message: string, type: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "UseAgentsError";
    this.type = type;
    this.details = details;
  }

  toJSON(): CliError {
    return {
      error: this.message,
      type: this.type,
      details: this.details,
    };
  }
}

export function formatError(error: unknown, debug = false): string {
  if (error instanceof UseAgentsError) {
    let output = `Error: ${error.message}`;
    if (error.details) {
      for (const [key, value] of Object.entries(error.details)) {
        output += `\n${key}: ${value}`;
      }
    }
    if (debug && error.stack) {
      output += `\n\n${error.stack}`;
    }
    return output;
  }

  if (error instanceof Error) {
    let output = `Error: ${error.message}`;
    if (debug && error.stack) {
      output += `\n\n${error.stack}`;
    }
    return output;
  }

  return `Error: ${String(error)}`;
}

export function printJsonError(error: unknown, debug = false): void {
  if (error instanceof UseAgentsError) {
    const json: Record<string, unknown> = {
      error: error.message,
      type: error.type,
    };
    if (error.details) {
      json.details = error.details;
    }
    if (debug && error.stack) {
      json.stack = error.stack;
    }
    console.error(JSON.stringify(json, null, 2));
    return;
  }

  const json: Record<string, unknown> = {
    error: error instanceof Error ? error.message : String(error),
    type: "unknown_error",
  };
  if (debug && error instanceof Error && error.stack) {
    json.stack = error.stack;
  }
  console.error(JSON.stringify(json, null, 2));
}
