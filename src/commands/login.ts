import { AUTH_FILE, readJson, writePrivateJson } from "../utils/filesystem.js";
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
  const registryUrl = getRegistryUrl();
  const existingAuth = await readJson<{ registryToken?: string; userEmail?: string }>(AUTH_FILE);

  if (existingAuth?.registryToken) {
    try {
      const response = await fetch(`${registryUrl.replace(/\/$/, "")}/get-session`, {
        headers: {
          Authorization: `Bearer ${existingAuth.registryToken}`,
        },
      });

      if (response.ok) {
        const session = (await response.json()) as { user?: { email?: string } };
        const email = session.user?.email ?? existingAuth.userEmail ?? "unknown";
        console.log(`Already logged in as ${email}`);
        return;
      }
    } catch {
      // Existing token is invalid or registry is unreachable; fall through to re-authenticate.
    }
  }

  console.log("Authenticate with the UseAgents registry.");
  console.log("Open https://useagents.io/settings.");
  console.log("If prompted, sign in first. Settings will show your registry session token.");
  console.log("\nPaste your session token: ");

  const token = await readStdinLine();

  if (!token) {
    throw new UseAgentsError("No token provided", "login_cancelled");
  }

  // Validate token by pinging the registry session endpoint.
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

    await writePrivateJson(AUTH_FILE, {
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
