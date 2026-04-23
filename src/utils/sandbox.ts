import { spawn } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { UseAgentsError } from "./errors.js";

export interface SandboxResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function runDocker(args: string[], stdin?: string): Promise<SandboxResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn("docker", args, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("error", (error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        reject(new UseAgentsError("Docker not found. Install Docker to use sandbox mode.", "docker_not_found"));
      } else {
        reject(error);
      }
    });

    proc.on("close", (exitCode) => {
      resolve({ stdout, stderr, exitCode: exitCode ?? 0 });
    });

    if (stdin) {
      proc.stdin?.write(stdin);
      proc.stdin?.end();
    }
  });
}

export async function isDockerAvailable(): Promise<boolean> {
  try {
    const result = await runDocker(["version", "--format", "{{.Server.Version}}"]);
    return result.exitCode === 0 && result.stdout.trim().length > 0;
  } catch {
    return false;
  }
}

export async function runInSandbox(
  agentPath: string,
  entrypoint: string,
  input: unknown,
  timeoutMs = 30000
): Promise<unknown> {
  const dockerAvailable = await isDockerAvailable();
  if (!dockerAvailable) {
    throw new UseAgentsError("Docker is not available", "docker_not_available");
  }

  const tempDir = await mkdtemp(join(tmpdir(), "useagents-sandbox-"));

  try {
    const wrapperScript = `
import { readFile } from "node:fs/promises";
import { join } from "node:path";

async function main() {
  const input = JSON.parse(process.env.AGENT_INPUT || "null");
  const agentPath = process.env.AGENT_PATH;
  const entrypoint = process.env.AGENT_ENTRYPOINT;

  const agentModule = await import(join(agentPath, entrypoint));
  const result = await agentModule.run(input, {
    agent: { name: "sandboxed", version: "0.0.0", installPath: agentPath },
    model: { generate: () => { throw new Error("Model not available in sandbox"); } },
    tools: {},
    secrets: { get: () => undefined },
    logger: { info: console.log, error: console.error },
  });

  console.log(JSON.stringify(result));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
`;

    const wrapperPath = join(tempDir, "wrapper.mjs");
    await writeFile(wrapperPath, wrapperScript, "utf-8");

    const agentMount = agentPath + ":/agent:ro";
    const wrapperMount = wrapperPath + ":/wrapper.mjs:ro";
    const inputEnv = "AGENT_INPUT=" + JSON.stringify(input);

    const args = [
      "run",
      "--rm",
      "--network", "none",
      "--read-only",
      "--tmpfs", "/tmp:noexec,nosuid,size=50m",
      "-v", agentMount,
      "-v", wrapperMount,
      "-e", inputEnv,
      "-e", "AGENT_PATH=/agent",
      "-e", `AGENT_ENTRYPOINT=${entrypoint}`,
      "--cpus", "1",
      "--memory", "256m",
      "node:20-alpine",
      "node", "/wrapper.mjs",
    ];

    const result = await Promise.race([
      runDocker(args),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new UseAgentsError("Sandbox execution timed out", "sandbox_timeout")), timeoutMs)
      ),
    ]);

    if (result.exitCode !== 0) {
      throw new UseAgentsError(
        `Sandbox execution failed: ${result.stderr || result.stdout}`,
        "sandbox_error",
        { exitCode: result.exitCode }
      );
    }

    const lines = result.stdout.trim().split("\n");
    const lastLine = lines[lines.length - 1];
    return JSON.parse(lastLine);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
