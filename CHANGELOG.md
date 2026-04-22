# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Core CLI scaffold with Commander.js (`agent` binary)
- Agent manifest validation using Zod (`agent.yaml`)
- Local agent installation from folder paths
- Git-based agent installation (GitHub shorthand + HTTPS URLs)
- Versioned runtime storage (`~/.useagents/runtimes/`)
- Active version symlinks (`~/.useagents/active/`)
- Runtime loader with `run(input, ctx)` contract
- Built-in tool registry: `echo.text`, `http.fetch`, `fs.readText`, `fs.writeText`
- Permission enforcement (network, filesystem, secrets)
- OpenRouter model adapter with streaming support
- Secret management (`~/.useagents/secrets/secrets.json` with 0600 perms)
- JSONL execution logging (`~/.useagents/state/logs.jsonl`)
- Structured error handling with `--debug` flag
- CLI commands: `install`, `run`, `info`, `list`, `update`, `remove`, `logs`, `validate`, `secret`
- `hello-world` example agent

### Changed
- N/A

### Deprecated
- N/A

### Removed
- N/A

### Fixed
- N/A

### Security
- N/A

## [Roadmap]

### 0.2.0 - Sandboxing & Security
- [ ] Deno/QuickJS sandboxed runtime (optional)
- [ ] Permission prompt on first run (grant/deny)
- [ ] File access audit logging
- [ ] Network request allowlisting by domain

### 0.3.0 - Registry & Distribution
- [ ] `useagents.dev` web registry
- [ ] `agent search <query>` command
- [ ] Semantic version resolution (`^`, `~`)
- [ ] Agent dependency management

### 0.4.0 - Advanced Runtime
- [ ] Python runtime support
- [ ] Docker-based isolation
- [ ] Streaming output from agents
- [ ] Background agent execution (`agent run --detach`)

### 0.5.0 - IDE Integration
- [ ] VS Code extension for agent development
- [ ] Agent manifest schema autocomplete
- [ ] Debug mode with breakpoints

### 1.0.0 - Stable Release
- [ ] Stable API guarantee
- [ ] Comprehensive test suite (>80% coverage)
- [ ] Official documentation site
- [ ] Windows/Linux/macOS CI

## [0.1.0] - 2025-04-22

### Added
- Initial MVP release
- All features listed under [Unreleased]
