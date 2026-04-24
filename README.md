# UseAgents CLI

> Package-manager-style CLI for installing, managing, and running local AI agents and agentic tools.

UseAgents (`agent`) manages two kinds of registry entries:

- **Direct agents** install runnable agent code into `~/.useagents/runtimes/` and can be executed with `agent run`. Example: `hello-world`.
- **Managed integrations** run registry-provided wrapper logic that orchestrates a third-party installer, updater, uninstaller, or status check. Example: `claude-code` or `openclaw`.

Managed integrations are not treated as packaged agent tarballs. They are tracked in UseAgents state, but the upstream tool may live in locations owned by the third-party installer, such as a native binary directory or global package manager.

## Installation

```bash
npm install -g @thesethrose/useagents
```

Requirements:

- Node.js `>=20`
- `git` for git-based installs
- `tar` for registry direct-agent installs
- Docker only when using Docker-backed sandbox execution

## Common Workflows

### Search the registry

```bash
agent search claude-code
agent search hello
agent search --type agent
agent search --type integration --page 2 --limit 5
agent get hello-world
agent get claude-code
```

`agent search` lists registry matches with their type, description, and install command. Direct agents show their latest agent version; managed integrations intentionally do not show wrapper versions.

### Install

```bash
# Managed integrations orchestrate third-party setup flows
agent install claude-code
agent install openclaw

# Direct agents install runnable code from registry tarballs
agent install hello-world
agent install @your-scope/hello-world

# Direct agents can also be installed from local folders or git
agent install ./path/to/agent
agent install github:your-org/your-agent
agent install https://github.com/your-org/your-agent
```

Use `--force` to overwrite an existing direct-agent version or force a managed integration reinstall when the wrapper supports it.

### List and inspect

```bash
agent list
agent list hello-world
agent info hello-world
agent info claude-code
agent config
agent doctor
```

`agent list` separates direct agents from managed integrations. Hidden filesystem entries under `~/.useagents/active/` are ignored.

### Run direct agents

```bash
agent run hello-world --input '{"name":"Developer"}'
agent run hello-world --sandbox --input '{"name":"Developer"}'
```

Only direct agents are runnable through `agent run`. Managed integrations expose their own upstream commands after installation.

Sandbox mode is enabled with `--sandbox` or by the manifest sandbox policy. Docker-backed sandbox execution is used only when Docker is available and the agent does not require tools, secrets, or a configured model; otherwise the CLI uses local permission enforcement.

### Update, upgrade, remove, and uninstall

```bash
agent update                 # Check registry connectivity
agent update hello-world     # Reinstall a specific direct agent from its recorded source
agent update claude-code     # Run the managed integration update flow

agent upgrade                # Upgrade recorded direct-agent installs
agent upgrade hello-world
agent upgrade claude-code

agent remove claude-code     # Remove UseAgents tracking, leave upstream tool intact
agent uninstall claude-code  # Run managed uninstall, then remove UseAgents tracking

agent remove hello-world     # Remove a direct agent from UseAgents
agent uninstall hello-world  # Same direct-agent cleanup path
```

For direct agents, `remove` and `uninstall` remove the active symlink, versioned runtime directory, and install record. For managed integrations, `remove` only removes UseAgents tracking; `uninstall` asks the wrapper to remove upstream install artifacts such as binaries while preserving credentials or application state unless the wrapper explicitly documents otherwise.

### Logs and secrets

```bash
agent logs hello-world
agent secret set OPENROUTER_API_KEY
agent secret list
```

Secrets are stored locally in `~/.useagents/secrets/secrets.json` with `0600` permissions when written by the CLI.

### Registry auth

```bash
agent login
agent logout
```

`agent login` prompts for a registry session token from `https://useagents.io/settings`, validates it against the registry auth endpoint, and stores it in `~/.useagents/state/auth.json`. Auth is used for registry publish/update APIs that require a logged-in session and verified email.

Registry installs use canonical registry artifact routes rather than publisher-supplied artifact URLs. If registry metadata includes an artifact SHA-256 checksum, the CLI verifies the downloaded tarball or managed-integration wrapper before installing. Deprecated packages install with a warning; yanked, quarantined, archived, or deleted packages do not install.

## Command Reference

| Command | Description |
|---|---|
| `agent search [text] [--type agent\|integration] [--page n] [--limit n]` | Search or browse registry entries |
| `agent get <agent>` | Show registry metadata for one entry |
| `agent install <source>` | Install a managed integration, registry direct agent, local folder, or git repo |
| `agent list [agent]` | List installed direct agents and managed integrations |
| `agent info <agent...>` | Show installed direct-agent manifest details or managed integration status |
| `agent run <agent> [-i <json>] [--sandbox]` | Execute an installed direct agent |
| `agent update [agent]` | Check registry connectivity, update a direct agent, or run a managed update flow |
| `agent upgrade [agent...]` | Upgrade direct-agent installs, or a named managed integration |
| `agent remove <agent>` | Remove UseAgents tracking; for managed integrations, leave upstream install intact |
| `agent uninstall <agent>` | Uninstall from UseAgents; for managed integrations, run wrapper uninstall first |
| `agent logs <agent>` | Show recent execution logs |
| `agent validate <path>` | Validate an `agent.yaml` manifest |
| `agent doctor` | Check UseAgents directories, registry connectivity, and Node.js version |
| `agent config` | Print local paths, registry URL, and relevant environment variables |
| `agent login` | Store registry authentication |
| `agent logout` | Remove registry authentication |
| `agent secret set <key>` | Store a local secret |
| `agent secret list` | List configured secret keys |

## Direct Agent Manifests

Direct agents are folders with an `agent.yaml` manifest and a JavaScript entrypoint.

```yaml
name: hello-world
version: 1.0.0
description: A simple hello world agent
runtime:
  type: javascript
  entrypoint: ./dist/index.js
permissions:
  network: false
  filesystem:
    read: []
    write: []
  secrets: []
tools:
  - echo.text
```

```javascript
export async function run(input, ctx) {
  const name = input?.name || "World";
  const echo = await ctx.tools["echo.text"]({ text: `Hello, ${name}!` });
  return { message: echo.text };
}
```

### Manifest Reference

```yaml
name: hello-world                 # kebab-case identifier, or @scope/name for registry packages
version: 1.0.0                    # x.y.z semver
description: "A simple hello world agent"

runtime:
  type: javascript                # currently the only supported runtime
  entrypoint: ./dist/index.js

model:
  provider: openrouter
  model: anthropic/claude-3.7-sonnet

inputs: {}
outputs: {}

permissions:
  network: false
  # or:
  # network:
  #   enabled: true
  #   domains: ["api.example.com", "*.openai.com"]
  filesystem:
    read: []
    write: []
  secrets:
    - OPENROUTER_API_KEY
  sandbox:
    enabled: false
    tools:
      - echo.text

tools:
  - echo.text
  - http.fetch
  - fs.readText
  - fs.writeText
```

The manifest schema is defined in `src/types.ts` and enforced by `agent validate`, `agent install`, and `agent run`.

### Runtime Contract

An agent entrypoint must export:

```javascript
export async function run(input, ctx) {
  return {};
}
```

The context object includes:

| Property | Description |
|---|---|
| `ctx.agent` | `{ name, version, installPath }` for the active direct agent |
| `ctx.model.generate(args)` | Call the configured model provider |
| `ctx.tools` | Permissioned tools declared by the manifest |
| `ctx.secrets.get(key)` | Read a declared secret |
| `ctx.logger.info(msg, data)` | Write structured info logs |
| `ctx.logger.error(msg, data)` | Write structured error logs |

## Storage Layout

```text
~/.useagents/
|-- runtimes/             # Versioned direct-agent installs
|   `-- hello-world/
|       `-- 1.0.0/
|-- active/               # Symlinks to active direct-agent versions
|   `-- hello-world -> ../runtimes/hello-world/1.0.0
|-- state/
|   |-- installs.json     # Direct-agent install records
|   |-- integrations.json # Managed integration records
|   |-- logs.jsonl        # Direct-agent execution logs
|   |-- audit.jsonl       # File/network/tool audit log
|   |-- permissions.json  # Remembered permission grants
|   `-- auth.json         # Registry auth token, when logged in
|-- secrets/
|   `-- secrets.json      # Local secret values
`-- cache/
    |-- registry/         # Downloaded direct-agent artifacts
    `-- integrations/     # Downloaded managed integration wrappers
```

## Environment

| Variable | Description |
|---|---|
| `USEAGENTS_REGISTRY` | Registry base URL. Defaults to `https://registry.useagents.io/v1` |
| `USEAGENTS_REGISTRY_CACHE_TTL` | Reserved for registry cache behavior |
| `USEAGENTS_OFFLINE` | Reserved for offline registry behavior |

## Development

```bash
cd cli
npm install
npm run typecheck
npm run lint
npm run test
npm run check
npm run build
node dist/index.js --help
```

The source entrypoint guard rejects `tsx src/index.ts` because `index.ts` is not a declared CLI binary. Use the built CLI (`node dist/index.js`) or the installed `agent` binary for manual testing.

## Security Model

1. Direct agents must declare all permissions in `agent.yaml`.
2. First run requires explicit permission approval, persisted in `~/.useagents/state/permissions.json`.
3. Secrets are stored separately and only exposed when declared by the manifest.
4. Filesystem and network access go through permission-aware tools.
5. File, network, and tool operations are written to `~/.useagents/state/audit.jsonl`.
6. Optional sandbox mode can use Docker for simple JavaScript agents when the agent has no tools, secrets, or configured model.

## Current Limitations

- Direct-agent runtime support is JavaScript only.
- `agent upgrade` without arguments upgrades recorded direct-agent installs only; named managed integrations can be updated with `agent update <name>` or `agent upgrade <name>`.
- Registry cache TTL and offline mode are exposed in configuration output but are not implemented yet.
