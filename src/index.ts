#!/usr/bin/env node
import { Command } from "commander";
import packageJson from "../package.json";
import { installCommand } from "./commands/install.js";
import { runCommand } from "./commands/run.js";
import { infoCommand } from "./commands/info.js";
import { getCommand } from "./commands/get.js";
import { listCommand } from "./commands/list.js";
import { updateCommand } from "./commands/update.js";
import { upgradeCommand } from "./commands/upgrade.js";
import { removeCommand } from "./commands/remove.js";
import { uninstallCommand } from "./commands/uninstall.js";
import { searchCommand } from "./commands/search.js";
import { logsCommand } from "./commands/logs.js";
import { validateCommand } from "./commands/validate.js";
import { secretCommand } from "./commands/secret.js";
import { doctorCommand } from "./commands/doctor.js";
import { configCommand } from "./commands/config.js";
import { loginCommand } from "./commands/login.js";
import { logoutCommand } from "./commands/logout.js";
import { ensureDirs } from "./utils/filesystem.js";
import { assertSafeCliInvocation } from "./utils/cli.js";

const program = new Command();

assertSafeCliInvocation(process.argv[1], Object.keys(packageJson.bin ?? {}));

program
  .name("agent")
  .description("UseAgents - Local agent package runner")
  .version(packageJson.version)
  .option("-v, --verbose", "Print verbose output")
  .option("-d, --debug", "Show stack traces on errors")
  .configureOutput({
    outputError: (str, write) => write(`Error: ${str.replace(/^error: /i, "")}`),
  });

program.hook("preAction", async () => {
  await ensureDirs();
});

program
  .command("search <text>")
  .description("Search for agents by name or description")
  .action(searchCommand);

program
  .command("get <agent>")
  .description("Display information about an agent from the registry")
  .action(getCommand);

program
  .command("info <agent...>")
  .description("Display information about installed agents")
  .action(infoCommand);

program
  .command("install <source>")
  .description("Install an agent from a local path, git repo, or registry")
  .option("-f, --force", "Overwrite existing installation")
  .option("-v, --verbose", "Print verbose output")
  .action(installCommand);

program
  .command("update [agent]")
  .description("Fetch latest registry metadata, or update a specific agent")
  .action(updateCommand);

program
  .command("upgrade [agent...]")
  .description("Upgrade installed agents to their latest versions")
  .action(upgradeCommand);

program
  .command("uninstall <agent>")
  .description("Uninstall an agent and remove from UseAgents")
  .option("-f, --force", "Force uninstall without confirmation")
  .action(uninstallCommand);

program
  .command("remove <agent>")
  .description("Remove an agent from UseAgents (keep upstream if managed integration)")
  .action(removeCommand);

program
  .command("list [agent]")
  .description("List installed agents and integrations")
  .action(listCommand);

program
  .command("run <agent>")
  .description("Run an installed agent")
  .option("-i, --input <json>", "JSON input to pass to agent")
  .option("--sandbox", "Run agent in sandbox mode with restricted tool access")
  .action(runCommand);

program
  .command("logs <agent>")
  .description("View execution logs for an agent")
  .action(logsCommand);

program
  .command("validate <path>")
  .description("Validate an agent manifest")
  .action(validateCommand);

program
  .command("doctor")
  .description("Check your system for potential problems")
  .action(doctorCommand);

program
  .command("login")
  .description("Authenticate with the UseAgents registry")
  .action(loginCommand);

program
  .command("logout")
  .description("Remove registry authentication")
  .action(logoutCommand);

program
  .command("config")
  .description("Show configuration and environment")
  .action(configCommand);

program
  .command("secret")
  .description("Manage secrets")
  .addCommand(
    new Command("set <key>")
      .description("Set a secret value")
      .action(secretCommand.set)
  )
  .addCommand(
    new Command("list")
      .description("List configured secrets")
      .action(secretCommand.list)
  );

program.parseAsync(process.argv).catch((error) => {
  const debug = program.opts().debug;
  if (debug) {
    console.error(error);
  } else {
    console.error(`Error: ${error.message || error}`);
  }
  process.exit(1);
});
