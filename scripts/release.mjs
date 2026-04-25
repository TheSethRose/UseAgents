#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const bump = process.argv[2] ?? "patch";
const allowedBumps = new Set(["patch", "minor", "major", "resume"]);

if (!allowedBumps.has(bump)) {
  console.error(`Unsupported release bump "${bump}". Use patch, minor, major, or resume.`);
  process.exit(1);
}

const branch = run("git", ["branch", "--show-current"]).trim();
if (!branch) {
  console.error("Release must run on a named branch.");
  process.exit(1);
}

assertNpmAuthenticated();
assertNpmOwner();

if (bump !== "resume") {
  const initialStatus = run("git", ["status", "--short"]).trim();
  if (initialStatus) {
    const rl = createInterface({ input, output });
    const answer = await rl.question("Working tree has changes. Include them in the release commit? [y/N] ");
    rl.close();
    if (!/^y(es)?$/i.test(answer.trim())) {
      console.error("Release aborted. Commit or stash existing changes first.");
      process.exit(1);
    }
  }

  runInherited("npm", ["version", bump, "--no-git-tag-version"]);
}

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const version = packageJson.version;
const tag = `v${version}`;

if (bump === "resume") {
  assertTagAtHead(tag);
} else if (tagExists(tag)) {
  console.error(`Tag ${tag} already exists.`);
  process.exit(1);
}

runInherited("npm", ["run", "release:check"]);

const otp = await askOtp();
if (!/^\d{6,8}$/.test(otp)) {
  console.error("OTP must be 6 to 8 digits.");
  process.exit(1);
}

if (bump !== "resume") {
  runInherited("git", ["add", "-A"]);
  runInherited("git", ["commit", "-m", `release: cli ${tag}`]);
  runInherited("git", ["tag", tag]);
}

try {
  runInherited("npm", ["publish"], { NPM_CONFIG_OTP: otp });
  runInherited("git", ["push", "origin", branch]);
  runInherited("git", ["push", "origin", tag]);
} catch (error) {
  console.error("\nRelease failed after creating the local commit/tag.");
  console.error(`Version: ${version}`);
  console.error(`Tag: ${tag}`);
  console.error("Inspect the failure, then either finish manually or delete the local tag before retrying.");
  process.exit(error.status ?? 1);
}

console.log(`Published @thesethrose/useagents@${version} and pushed ${branch} plus ${tag}.`);

function run(command, args) {
  return execFileSync(command, args, { encoding: "utf8" });
}

function runInherited(command, args, env = {}) {
  const result = spawnSync(command, args, { env: { ...process.env, ...env }, stdio: "inherit" });
  if (result.status !== 0) {
    const error = new Error(`${command} ${args.join(" ")} failed`);
    error.status = result.status ?? 1;
    throw error;
  }
}

function tagExists(tag) {
  const result = spawnSync("git", ["rev-parse", "--verify", "--quiet", tag], { stdio: "ignore" });
  return result.status === 0;
}

function assertTagAtHead(tag) {
  const tagCommit = run("git", ["rev-list", "-n", "1", tag]).trim();
  const headCommit = run("git", ["rev-parse", "HEAD"]).trim();
  if (tagCommit !== headCommit) {
    console.error(`Cannot resume: ${tag} does not point at HEAD.`);
    process.exit(1);
  }
}

function assertNpmAuthenticated() {
  const result = spawnSync("npm", ["whoami"], { encoding: "utf8" });
  if (result.status !== 0) {
    console.error("npm is not authenticated. Run `npm login` once, then rerun `npm run release -- <patch|minor|major|resume>`.");
    process.exit(1);
  }
}

function assertNpmOwner() {
  const result = spawnSync("npm", ["owner", "ls", "@thesethrose/useagents"], { encoding: "utf8" });
  if (result.status !== 0 || !result.stdout.includes("thesethrose")) {
    console.error("Current npm account does not appear to own @thesethrose/useagents.");
    console.error("Run `npm owner ls @thesethrose/useagents` and fix package access before releasing.");
    process.exit(1);
  }
}

async function askOtp() {
  const rl = createInterface({ input, output });
  try {
    return (await rl.question("npm OTP: ")).trim();
  } finally {
    rl.close();
  }
}
