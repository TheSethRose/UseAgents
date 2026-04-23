import { rm } from "node:fs/promises";
import { AUTH_FILE } from "../utils/filesystem.js";
import { UseAgentsError } from "../utils/errors.js";

export async function logoutCommand(): Promise<void> {
  try {
    await rm(AUTH_FILE);
    console.log("Logged out. Registry token removed.");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      console.log("Not logged in.");
      return;
    }
    throw new UseAgentsError("Failed to remove auth file", "logout_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
