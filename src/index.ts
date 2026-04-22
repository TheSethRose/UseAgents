#!/usr/bin/env node
import { Command } from "commander";
import packageJson from "../package.json";
import { installCommand } from "./commands/install.js";
import { runCommand } from "./commands/run.js";
import { infoCommand } from "./commands/info.js";
import { listCommand } from "./commands/list.js";
import { updateCommand } from "./commands/update.js";
import { removeCommand } from "./commands/remove.js";
import { uninstallCommand } from "./commands/uninstall.js";
import { logsCommand } from "./commands/logs.js";
import { validateCommand } from "./commands/validate.js";
import { secretCommand } from "./commands/secret.js";
import { ensureDirs } from "./utils/filesystem.js";
import { assertSafeCliInvocation } from "./utils/cli.js";

const program = new Command();

assertSafeCliInvocation(process.argv[1], Object.keys(packageJson.bin ?? {}));

program
  .name("agent")
  .description("UseAgents - Local agent package runner")
  .version(packageJson.version)
  .option("--debug", "Show stack traces on errors");

program.hook("preAction", async () => {
  await ensureDirs();
});

program
  .command("install <source>")
  .description("Install an agent from a local path or git repo")
  .action(installCommand);

program
  .command("run <agent-name>")
  .description("Run an installed agent")
  .option("-i, --input <json>", "JSON input to pass to agent")
  .option("--sandbox", "Run agent in sandbox mode with restricted tool access")
  .action(runCommand);

program
  .command("info <agent-name>")
  .description("Show agent metadata")
  .action(infoCommand);

program
  .command("list")
  .description("List installed agents")
  .action(listCommand);

program
  .command("update <agent-name>")
  .description("Update an installed agent")
  .action(updateCommand);

program
  .command("remove <agent-name>")
  .description("Remove an installed agent from UseAgents")
  .action(removeCommand);

program
  .command("uninstall <agent-name>")
  .description("Uninstall the upstream software and remove from UseAgents")
  .action(uninstallCommand);

program
  .command("logs <agent-name>")
  .description("View execution logs for an agent")
  .action(logsCommand);

program
  .command("validate <path>")
  .description("Validate an agent manifest")
  .action(validateCommand);

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
