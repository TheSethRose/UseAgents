import { basename } from "path";
import { UseAgentsError } from "./errors.js";

export const DEFAULT_USEAGENTS_BIN_NAME = "agent";

function isDirectNodeEntrypoint(invokedName: string): boolean {
  return invokedName.endsWith(".js") || invokedName.endsWith(".mjs") || invokedName.endsWith(".cjs");
}

export function getInvokedCliName(argvEntry: string | undefined): string | null {
  if (!argvEntry) {
    return null;
  }

  const name = basename(argvEntry).trim();
  return name.length > 0 ? name : null;
}

export function assertSafeCliInvocation(argvEntry: string | undefined, allowedBinNames: readonly string[]): void {
  const invokedName = getInvokedCliName(argvEntry);

  if (!invokedName) {
    return;
  }

  if (!isDirectNodeEntrypoint(invokedName) && !allowedBinNames.includes(invokedName)) {
    throw new UseAgentsError(
      `UseAgents must not be invoked as '${invokedName}'. Use one of the declared CLI binaries instead: ${allowedBinNames.join(", ")}.`,
      "invalid_cli_invocation",
      {
        invokedName,
        allowedBinNames: [...allowedBinNames],
      }
    );
  }
}