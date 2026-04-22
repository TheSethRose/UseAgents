# UseAgents MVP Spec

## Goal

Build a basic local agent package runner that can:

1. define an agent with a manifest
2. install it locally
3. run it with input
4. give it controlled access to tools and secrets
5. store logs and execution history
6. support versioned local installs

This is a local-first developer MVP.
Do not build hosted infra, public marketplace, billing, team management, or full registry systems yet.

---

## MVP Scope

### In scope

- Local CLI
- Local manifest format
- Local install from folder or git repo
- Local versioned install storage
- Run agent by name
- Basic model adapter layer
- Basic tool adapter layer
- Basic secret access
- Basic permission prompts
- Execution logs
- Simple update and remove flows

### Out of scope

- Hosted registry
- Public publishing flow
- Web app
- Desktop app
- Multi-user support
- Team policy management
- Marketplace ratings/discovery
- Full sandboxing/containers
- Advanced workflow graphs
- Long-running daemon agents
- Billing
- External tool SDKs or third-party tool packages
- Agent-to-agent dependency graphs

---

## Primary User Stories

### 1. Install a local agent

As a developer, I can install an agent from a local folder so I can test packaging and runtime.

Example:

```bash
ua install ./agents/support-triager
```

### 2. Install from git

As a developer, I can install an agent from a git repo so I can test reusable distribution.

Example:

```bash
ua install github:sethrose/support-triager
```

### 3. Run an agent

As a developer, I can run an installed agent with JSON input.

Example:

```bash
ua run support-triager --input '{"message":"Customer cannot log in"}'
```

### 4. Inspect an agent

As a developer, I can view agent metadata, permissions, version, and install path.

Example:

```bash
ua info support-triager
```

### 5. Update an agent

As a developer, I can update an installed agent to a newer version.

Example:

```bash
ua update support-triager
```

### 6. Remove an agent

As a developer, I can remove an agent cleanly.

Example:

```bash
ua remove support-triager
```

### 7. View logs

As a developer, I can inspect execution logs and failures.

Example:

```bash
ua logs support-triager
```

---

## CLI Commands

### Required commands

```bash
ua install <source>
ua run <agent-name> --input '<json>'
ua info <agent-name>
ua list
ua update <agent-name>
ua remove <agent-name>
ua logs <agent-name>
ua validate <path>
ua secret set <KEY>
ua secret list
```

### Nice-to-have if cheap

```bash
ua switch <agent-name> <version>
```

---

## Local Filesystem Layout

```text
~/.useagents/
  runtimes/
    support-triager/
      1.0.0/
        agent.yaml
        dist/
        package.json
  active/
    support-triager -> ../runtimes/support-triager/1.0.0
  state/
    installs.json
    logs.jsonl
    permissions.json
  secrets/
    secrets.json
  cache/
```

### Notes

- `runtimes/` stores versioned installs
- `active/` points to the active version of each installed agent
- `state/` stores runtime metadata
- `secrets/` is local-only for MVP
- `cache/` stores downloaded git repos or package tarballs
- agents are invoked through `ua run <agent-name>` in MVP; standalone per-agent executables are out of scope

---

## Agent Manifest

File name:

```text
agent.yaml
```

### Example manifest

```yaml
name: support-triager
version: 1.0.0
description: Classifies inbound support messages
runtime:
  type: javascript
  entrypoint: ./dist/index.js
model:
  provider: openrouter
  model: anthropic/claude-3.7-sonnet
inputs:
  type: object
outputs:
  type: object
permissions:
  network: true
  filesystem:
    read: []
    write: []
  secrets:
    - OPENROUTER_API_KEY
tools:
  - echo.text
  - http.fetch
  - fs.readText
```

### Validation rules

- `name` required and kebab-case
- `version` required and semver
- `description` required
- `runtime.type` required and must be `javascript` in MVP
- `runtime.entrypoint` required for code agents and must exist after install/build
- `model.provider` and `model.model` required only for LLM-backed agents
- `inputs` and `outputs` are descriptive metadata only in MVP
- `permissions` required
- `tools` optional but every entry must reference a known built-in tool adapter
- Unknown manifest fields are ignored in MVP
- reject install if manifest is invalid

### Manifest semantics

- `runtime.type: javascript` means the agent is executed by Bun at runtime
- agents may be authored in TypeScript, but the installed entrypoint must resolve to executable JavaScript
- `model` may be omitted for agents that do not call `ctx.model.generate(...)`
- no runtime schema validation is performed against inputs or outputs in MVP

---

## Supported Agent Type for MVP

Only support one agent type in v1:

### Code agent

A code agent exports a standard `run()` function and is executed by the runtime.

Example runtime target:

```ts
export async function run(input, ctx) {
  return { ok: true }
}
```

Do not support these yet:

- workflow agents
- prompt-only agents
- daemon agents
- subagent graphs

Those can come later.

---

## Runtime Contract

Each installed agent must resolve to a module that exposes:

```ts
export type AgentRun = (
  input: unknown,
  ctx: AgentContext
) => Promise<unknown>
```

### AgentContext

```ts
type AgentContext = {
  agent: {
    name: string
    version: string
    installPath: string
  }
  model: {
    generate: (args: {
      system?: string
      prompt: string
      temperature?: number
      responseFormat?: "text" | "json"
    }) => Promise<{ text: string; usage?: unknown }>
  }
  tools: Record<string, (input: unknown) => Promise<unknown>>
  secrets: {
    get: (key: string) => string | undefined
  }
  logger: {
    info: (msg: string, data?: unknown) => void
    error: (msg: string, data?: unknown) => void
  }
}
```

### Runtime behavior

- load manifest
- validate requested permissions
- resolve secrets
- resolve allowed tools
- load entrypoint
- call exported `run(input, ctx)`
- capture result
- write log record
- return JSON output

### Runtime failure behavior

- on success, print JSON output to stdout and exit `0`
- on failure, print a structured JSON error object to stderr and exit non-zero
- default error shape:

```json
{
  "error": "agent manifest invalid",
  "type": "manifest_error",
  "details": {
    "field": "runtime.entrypoint",
    "reason": "file does not exist"
  }
}
```

- include stack traces only when `--debug` is passed

---

## Install Sources

### Must support

1. local folder path
2. git repo URL or GitHub shorthand

### Install process

1. read source
2. find `agent.yaml`
3. validate manifest
4. copy files into a versioned runtime directory
5. mark installed version active
6. persist install metadata

### Source resolution rules

- local installs must point to a directory containing `agent.yaml` at the root
- `github:owner/repo` clones the repository default branch and expects `agent.yaml` at the repo root
- multi-agent repos and subdirectory install targets are out of scope for MVP
- `ua update <agent-name>` refetches the original source, reads the manifest again, and installs only if the fetched version is newer than installed versions

### Constraints

- installed agents must include a runnable JavaScript entrypoint at the declared path
- dependency installation and build steps are out of scope for MVP
- source packages are expected to be prebuilt before install
- fail fast with readable errors

---

## Model Adapter Layer

### MVP requirement

Support one provider first:

- OpenRouter

### Interface

```ts
type ModelAdapter = {
  generate(args: {
    model: string
    apiKey: string
    system?: string
    prompt: string
    temperature?: number
    responseFormat?: "text" | "json"
  }): Promise<{ text: string; usage?: unknown }>
}
```

### MVP behavior

- provider selected from manifest
- key pulled from declared secrets
- no streaming required yet
- JSON mode can be best-effort only
- runtime model override is out of scope for MVP, but the design should not block adding `ua run --model ...` later

Do not add multiple providers first.
One provider is enough to prove the system.

---

## Tool Adapter Layer

### MVP requirement

Support a tiny fixed registry of built-in tools shipped with the UseAgents CLI.

Start with:

- `echo.text`
- `http.fetch`
- `fs.readText`
- `fs.writeText`

### Rules

- tools must be explicitly declared in the manifest
- tools not declared are unavailable
- tool calls should fail with a permission error if not allowed
- third-party tool packages and tool discovery are out of scope for MVP

### Example

```ts
tools["echo.text"]({ text: "hello" })
tools["http.fetch"]({ url: "https://example.com" })
```

### Notes

- `http.fetch` must respect `permissions.network`
- `fs.readText` and `fs.writeText` must respect allowed read/write paths
- do not build OAuth tools yet

---

## Secret Handling

### MVP requirement

Local secrets only.

Store secrets in a local JSON file or simple encrypted local store if easy.
Plain local JSON is acceptable for MVP if clearly marked as dev-only.

### Storage rules

- `~/.useagents/secrets/secrets.json` is acceptable for MVP
- create the secrets file with owner-only permissions where supported (for example, `0600` on Unix-like systems)
- environment variable fallback is acceptable if secret commands are deferred briefly during bootstrapping

### Commands

At minimum, support:

```bash
ua secret set OPENROUTER_API_KEY
ua secret list
```

### Runtime rules

- agent can only access secrets declared in the manifest
- undeclared secret access returns `undefined` or throws a permission error
- missing required secrets should fail before agent execution begins
- secret values must never be printed to stdout, stderr, logs, or permission summaries

---

## Permissions

### Required permission categories

- network
- filesystem read paths
- filesystem write paths
- secrets
- tools

### Path resolution rules

- symlinks must be resolved to normalized absolute paths before read/write permission checks
- relative filesystem permission paths are resolved relative to the installed agent runtime directory
- absolute paths are allowed for MVP but should be clearly surfaced in the install prompt
- path checks must use normalized absolute paths before enforcement

### Install-time prompt

Show requested access clearly before completing install.

Example:

```text
This agent requests:
- Network access
- Secrets: OPENROUTER_API_KEY
- Tools: http.fetch, fs.readText
- Filesystem read: ./data
- Filesystem write: ./scratch
```

### MVP enforcement

- network denied if not allowed
- filesystem denied outside allowed paths
- secret access limited to declared keys
- tool access limited to declared tools

No need for OS-level sandboxing yet.
App-level enforcement is enough for v1.

---

## Logs and Execution History

### Must capture

- timestamp
- agent name
- version
- input
- output
- status
- duration_ms
- error message if failed

### Storage

Use JSONL for v1 unless a stronger need for queryable local storage appears during implementation.

```text
~/.useagents/state/logs.jsonl
```

JSONL keeps the MVP simple, append-friendly, grep-friendly, and migration-light.

### CLI

```bash
ua logs support-triager
```

Should show recent runs with status and error summary.

### Redaction rules

- log records should redact declared secret values if they appear in input, output, or error text
- log input/output may be truncated if excessively large

---

## Versioning

### MVP behavior

- multiple installed versions can exist
- one active version per agent
- install of a newer version switches active version automatically

### Nice-to-have

```bash
ua switch support-triager 1.0.0
```

If not implemented in v1, the storage layout must still preserve rollback-friendly installs.

---

## Error Handling

All user-facing failures should be explicit and actionable.

### Required error cases

- manifest missing
- manifest invalid
- entrypoint missing
- agent not found
- invalid JSON input
- required secret missing
- disallowed tool access
- filesystem permission denied
- network permission denied
- runtime threw exception

### Example error format

```text
Error: agent manifest invalid
Field: runtime.entrypoint
Reason: file does not exist
```

Do not return vague stack dumps unless `--debug` is passed.

---

## Suggested Tech Stack

```text
Language: TypeScript
Runtime: Bun
CLI: Commander
Schema validation: Zod
YAML parsing: yaml
Storage: JSONL
HTTP: native fetch
Bundling: tsdown or tsup
```

Recommendation:
Use Bun + TypeScript + Zod + JSONL for the first end-to-end proof.

---

## Acceptance Criteria

### Install

- can install an agent from local path
- can install an agent from git source
- invalid manifests are rejected with clear errors
- installed agent is stored in a versioned runtime path

### Run

- can run installed agent by name
- input JSON is passed to `run()`
- output JSON is returned to CLI
- runtime errors are captured and logged

### Permissions

- undeclared tools are blocked
- undeclared secrets are blocked
- network access is blocked when disabled
- filesystem access is limited to allowed paths

### Logs

- each execution produces a stored log entry
- logs can be viewed from CLI

### Update/remove

- can update an installed agent
- can remove an agent cleanly

---

## Example Happy Path

### Install

```bash
ua install ./agents/support-triager
```

### Run

```bash
ua run support-triager --input '{"message":"Customer cannot log in"}'
```

### Output

```json
{
  "category": "access_issue",
  "priority": "medium",
  "route_to": "helpdesk"
}
```

---

# UseAgents MVP Milestones

## Milestone 0: Project Foundation

- Initialize CLI project
- Set up Bun + TypeScript runtime
- Add command parser
- Add config/constants for local storage paths
- Add basic error formatter and logger

## Milestone 1: Manifest Spec and Validation

- Define `agent.yaml` schema
- Parse YAML manifest
- Validate required fields
- Validate semver, runtime, permissions, tools, and paths
- Add `ua validate <path>`

## Milestone 2: Local Install Engine

- Install agent from local folder
- Copy files into versioned runtime directory
- Create active version symlink or pointer
- Persist install metadata
- Add readable install errors

## Milestone 3: Git Install Engine

- Install agent from git repo or GitHub shorthand
- Clone or fetch source into cache
- Reuse the same validation and install pipeline
- Detect newer manifest versions during update

## Milestone 4: Runtime Loader

- Resolve installed active agent
- Load manifest and entrypoint
- Import compiled module
- Enforce exported `run(input, ctx)` contract
- Return JSON output to CLI

## Milestone 5: CLI Run Path

- Implement `ua run <agent-name> --input '<json>'`
- Parse and validate input JSON
- Execute agent
- Print structured JSON result
- Surface runtime failures cleanly

## Milestone 6: Model Adapter

- Add model adapter interface
- Implement OpenRouter provider
- Pull model config from manifest
- Pull API key from approved secret source
- Expose `ctx.model.generate(...)`

## Milestone 7: Tool Adapter Registry

- Implement fixed built-in tools:
  - `echo.text`
  - `http.fetch`
  - `fs.readText`
  - `fs.writeText`
- Register built-in tools by name
- Only expose tools declared in the manifest
- Fail on undeclared tool access

## Milestone 8: Permission Enforcement

- Enforce network allow/deny
- Enforce filesystem read path allowlist
- Enforce filesystem write path allowlist
- Enforce secret allowlist
- Enforce tool allowlist
- Show install-time permission summary

## Milestone 9: Secret Handling

- Add local secret storage or env fallback
- Implement:
  - `ua secret set <KEY>`
  - `ua secret list`
- Limit runtime secret access to declared keys only

## Milestone 10: Logs and Execution History

- Store per-run execution records
- Capture:
  - timestamp
  - agent name
  - version
  - input
  - output
  - status
  - duration_ms
  - error message if failed
- Implement `ua logs <agent-name>`

## Milestone 11: Agent Inspection and Listing

- Implement `ua info <agent-name>`
- Implement `ua list`
- Show installed versions, active version, permissions, and install path

## Milestone 12: Update and Remove

- Implement `ua update <agent-name>`
- Install newer version and switch active version
- Implement `ua remove <agent-name>`
- Clean up active pointer and metadata safely

## Milestone 13: Version Management

- Support multiple installed versions per agent
- Track one active version
- Add `ua switch <agent-name> <version>` if feasible
- Preserve rollback-friendly install structure

## Milestone 14: Error Handling Hardening

- Add explicit errors for:
  - missing manifest
  - invalid manifest
  - missing entrypoint
  - agent not found
  - invalid JSON input
  - missing secret
  - permission denied
  - runtime exception
- Add optional `--debug` for stack traces

## Milestone 15: First End-to-End Proof

- Developer can create a valid agent folder
- Install it locally
- Run it from CLI
- Use one model call
- Use allowed tools
- See logs for success or failure

# Release Gates

## MVP Alpha

- Milestones 0 through 5 complete
- Local install and local run work end to end

## MVP Beta

- Milestones 6 through 10 complete
- Models, tools, permissions, secrets, and logs work

## MVP v1

- Milestones 11 through 15 complete
- Basic usable developer product with install, run, inspect, update, remove, and versioned local execution
