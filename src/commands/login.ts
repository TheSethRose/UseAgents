import { AUTH_FILE, writeJson } from "../utils/filesystem.js";
import { getRegistryUrl } from "../registry.js";
import { UseAgentsError } from "../utils/errors.js";

function readStdinLine(): Promise<string> {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    stdin.setEncoding("utf-8");
    stdin.resume();

    let data = "";
    const onData = (chunk: string) => {
      data += chunk;
      if (data.includes("\n")) {
        stdin.pause();
        stdin.removeListener("data", onData);
        resolve(data.trim());
      }
    };

    stdin.on("data", onData);
  });
}

export async function loginCommand(): Promise<void> {
  console.log("Authenticate with the UseAgents registry.");
  console.log("Sign in at https://useagents.io/settings to copy your session token.");
  console.log("\nPaste your session token: ");

  const token = await readStdinLine();

  if (!token) {
    throw new UseAgentsError("No token provided", "login_cancelled");
  }

  // Validate token by pinging the registry session endpoint.
  const registryUrl = getRegistryUrl();
  try {
    const response = await fetch(`${registryUrl.replace(/\/$/, "")}/get-session`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new UseAgentsError("Invalid session token", "invalid_token", {
        status: response.status,
      });
    }

    const session = (await response.json()) as { user?: { email?: string } };
    const email = session.user?.email ?? "unknown";

    await writeJson(AUTH_FILE, {
      registryToken: token,
      userEmail: email,
    });

    console.log(`Logged in as ${email}`);
  } catch (error) {
    if (error instanceof UseAgentsError) throw error;
    throw new UseAgentsError(
      "Failed to validate token",
      "registry_unreachable",
      { error: error instanceof Error ? error.message : String(error) }
    );
  }
}
