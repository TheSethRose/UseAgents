import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { LogEntry } from "../types.js";

export class Logger {
  private logs: LogEntry[] = [];
  private logFile?: string;

  constructor(logFile?: string) {
    this.logFile = logFile;
  }

  info(msg: string, data?: unknown): void {
    const entry = { timestamp: new Date().toISOString(), level: "info", message: msg, data };
    this.logs.push(entry as unknown as LogEntry);
  }

  error(msg: string, data?: unknown): void {
    const entry = { timestamp: new Date().toISOString(), level: "error", message: msg, data };
    this.logs.push(entry as unknown as LogEntry);
  }

  async flush(entry: LogEntry): Promise<void> {
    if (this.logFile) {
      await mkdir(dirname(this.logFile), { recursive: true });
      const line = JSON.stringify(entry) + "\n";
      const stream = createWriteStream(this.logFile, { flags: "a" });
      stream.write(line);
      stream.end();
    }
  }
}
