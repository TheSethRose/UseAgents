# UseAgents

> Local agent package runner for AI agents

UseAgents (`agent`) is a CLI tool that lets you install, manage, and run AI agents locally — like a package manager, but for autonomous agents.

## Why UseAgents?

Most AI agent platforms require cloud infrastructure or complex setup. UseAgents brings the simplicity of package managers to AI agents:

- **Install agents like packages**: `agent install github:org/agent`
- **Run them locally**: `agent run my-agent --input '{"task": "write code"}'`
- **Version management**: Multiple versions installed, one active
- **Permission enforcement**: Agents declare what they need, you control access
- **Secret management**: Store API keys securely, inject only when needed

## Quick Start

### Installation

```bash
npm install -g @thesethrose/useagents
```

### Install an Agent

```bash
# From a local folder
agent install ./examples/hello-world

# From GitHub (shorthand)
agent install github:your-org/hello-world

# From any git URL
agent install https://github.com/your-org/hello-world
```

### Run an Agent

```bash
agent run hello-world --input '{"name": "Developer"}'
```

### Try the OpenClaw Example

```bash
agent install openclaw
agent run openclaw
```

This example installs OpenClaw through UseAgents: it checks whether `openclaw` is already installed and, if not, can guide or initiate the documented OpenClaw installer before handing you off to `openclaw onboard --install-daemon`.

It is intentionally **not** a new manifest capability for arbitrary remote software installs during `agent install`; it is a self-contained OpenClaw example package that handles the documented install and onboarding handoff.

### Run in Sandbox Mode

```bash
agent run hello-world --sandbox --input '{"name": "Developer"}'
```

Sandbox mode runs agents in an isolated Docker container with:
- No network access
- Read-only filesystem
- Memory and CPU limits
- Tool restrictions

### Manage Agents

```bash
agent list                    # List installed agents
agent info hello-world        # Show agent details
agent update hello-world      # Update to latest version
agent remove hello-world      # Uninstall an agent
agent logs hello-world        # View execution history
```

## Writing an Agent

Agents are just folders with an `agent.yaml` manifest and an entrypoint.

### Minimal Agent

```yaml
# agent.yaml
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
// dist/index.js
export async function run(input, ctx) {
  const name = input?.name || "World";
  const echo = await ctx.tools["echo.text"]({ text: `Hello, ${name}!` });
  return { message: echo.text };
}
```

### Agent Context

When an agent runs, it receives a context object (`ctx`) with:

| Property | Type | Description |
|----------|------|-------------|
| `ctx.agent` | `{ name, version, installPath }` | Agent metadata |
| `ctx.model.generate()` | `async ({ prompt, system, temperature, responseFormat })` | Call LLM (if configured) |
| `ctx.tools` | `Record<string, Function>` | Permissioned tools |
| `ctx.secrets.get(key)` | `(key: string) => string \| undefined` | Access secrets |
| `ctx.logger.info()` | `(msg: string, data?) => void` | Structured logging |

### Manifest Reference

```yaml
name: hello-world                 # kebab-case identifier
version: 1.0.0                    # semver

description: "A simple hello world agent"

runtime:
  type: javascript                # runtime type (currently: javascript)
  entrypoint: ./dist/index.js     # entry file

model:                            # optional LLM config
  provider: openrouter            # model provider
  model: anthropic/claude-3.7-sonnet

permissions:                      # what the agent needs
  network: false                  # internet access?
  # or restrict to specific domains:
  # network:
  #   enabled: true
  #   domains: ["api.example.com", "*.openai.com"]
  filesystem:
    read: []                      # paths allowed for reading
    write: []                     # paths allowed for writing
  secrets:
    - OPENROUTER_API_KEY          # required secrets
  sandbox:                        # optional sandbox policy
    enabled: false
    tools:                        # tools allowed in sandbox mode
      - echo.text

tools:                            # available tools
  - echo.text                     # echo input back
  - http.fetch                    # make HTTP requests
  - fs.readText                   # read files
  - fs.writeText                  # write files
```

## Architecture

```
~/.useagents/
├── runtimes/          # Versioned agent installs
│   └── hello-world/
│       └── 1.0.0/
│           ├── agent.yaml
│           └── dist/
│               └── index.js
├── active/            # Symlinks to active versions
│   └── hello-world -> ../runtimes/hello-world/1.0.0
├── state/
│   ├── installs.json   # Install registry
│   ├── logs.jsonl      # Execution history
│   ├── audit.jsonl     # File/network access audit log
│   └── permissions.json # Granted permission records
├── secrets/
│   └── secrets.json   # Encrypted secrets (0600 perms)
└── cache/             # Git clone cache
```

## CLI Reference

| Command | Description |
|---------|-------------|
| `agent install <source>` | Install from local path or git repo |
| `agent run <agent> [-i <json>] [--sandbox]` | Execute an agent |
| `agent info <agent>` | Show agent metadata |
| `agent list` | List installed agents |
| `agent update <agent>` | Update to latest version |
| `agent remove <agent>` | Uninstall an agent |
| `agent logs <agent>` | View execution history |
| `agent validate <path>` | Validate agent.yaml |
| `agent secret set <key>` | Store a secret |
| `agent secret list` | List stored secrets |

## Development

```bash
# Clone the repo
git clone https://github.com/thesethrose/useagents.git
cd useagents

# Install dependencies
npm install

# Build
npm run build

# Run locally
node dist/index.js --help

# Test with example agent
node dist/index.js install ./examples/hello-world
node dist/index.js run hello-world

# Try the OpenClaw example
node dist/index.js install openclaw
node dist/index.js run openclaw
```

## Security Model

1. **Manifest declarations**: Agents must declare all permissions in `agent.yaml`
2. **Permission prompts**: First run requires explicit user approval of requested permissions
3. **Secret isolation**: Secrets are stored separately, injected only when declared
4. **Filesystem sandboxing**: Agents can only access declared paths
5. **Network control**: Internet access is opt-in per agent, with domain allowlisting
6. **Audit logging**: All executions and file/network access logged to `~/.useagents/state/`
7. **Docker sandboxing**: Optional containerized execution with resource limits and tool restrictions

## Roadmap

See [CHANGELOG.md](CHANGELOG.md) for planned features.

Highlights:
- **v0.2.0**: Sandboxed runtime (Deno/QuickJS), permission prompts
- **v0.3.0**: Web registry, `agent search`, semver resolution
- **v0.4.0**: Python runtime, Docker isolation, background execution
- **v0.5.0**: VS Code extension
- **v1.0.0**: Stable API, comprehensive tests, official docs

## Contributing

Contributions welcome! Please read our [Contributing Guide](CONTRIBUTING.md) first.

## License

This project is licensed under the [MIT License](LICENSE).
