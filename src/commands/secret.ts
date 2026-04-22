import { readFile, writeFile, access, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { createInterface } from "node:readline";
import { SECRETS_FILE } from "../utils/filesystem.js";

export async function loadSecrets(): Promise<Record<string, string>> {
  try {
    await access(SECRETS_FILE);
    const content = await readFile(SECRETS_FILE, "utf-8");
    return JSON.parse(content);
  } catch {
    return {};
  }
}

async function saveSecrets(secrets: Record<string, string>): Promise<void> {
  await mkdir(dirname(SECRETS_FILE), { recursive: true });
  await writeFile(SECRETS_FILE, JSON.stringify(secrets, null, 2) + "\n", {
    mode: 0o600,
    encoding: "utf-8",
  });
}

export async function setSecret(key: string): Promise<void> {
  const secrets = await loadSecrets();
  
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  const value = await new Promise<string>((resolve) => {
    rl.question(`Enter value for ${key}: `, (answer) => {
      resolve(answer);
      rl.close();
    });
  });
  
  secrets[key] = value;
  await saveSecrets(secrets);
  
  console.log(`Secret ${key} set.`);
}

export async function listSecrets(): Promise<void> {
  const secrets = await loadSecrets();
  const keys = Object.keys(secrets);
  
  if (keys.length === 0) {
    console.log("No secrets configured.");
    return;
  }
  
  console.log("Configured secrets:");
  for (const key of keys) {
    console.log(`  ${key}`);
  }
}

export const secretCommand = {
  set: setSecret,
  list: listSecrets,
};
