# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2026-04-23

### Added
- `useagents.io` web registry deployed at `https://registry.useagents.io`
- `agent search <query>` command to search the remote registry
- CLI points to `registry.useagents.io/v1` by default (override with `USEAGENTS_REGISTRY` env var)
- Managed integration examples for `goclaw`, `picoclaw`, `pi-mono`, `claude-code`, `gemini-cli`, `qwen-cli`, and `nanoclaw`
- Interim registry entries for the new managed integrations so they can be installed and tested locally

### Infrastructure
- Registry API deployed via Coolify on Hetzner-prod-srdev-ash-02
- Private GitHub repo (`TheSethRose/useagents-registry`) with SSH deploy key authentication

## [0.2.4] - 2026-04-22

### Added
- Permission prompt on first run (grant/deny with remembered choice in `~/.useagents/state/permissions.json`)
- File access audit logging (`~/.useagents/state/audit.jsonl` records read/write operations)
- Network request allowlisting by domain with wildcard support (`*.example.com`)
- `--sandbox` flag for `agent run` to force isolated execution
- Tool-level sandbox policy (allow/deny specific tools in sandbox mode)
- Docker-based sandboxed runtime (optional, per-agent, with resource limits; JavaScript-only for now, multi-runtime in v0.4.0)

### Security
- All file system and network access is now audited
- Permission grants are persisted and validated on each run
- Sandbox mode runs agents in isolated Docker containers with no network access

## [Roadmap]

### 0.4.0 - Multi-Runtime & Isolation
- [ ] Python runtime support (first non-JavaScript runtime)
- [ ] Rust runtime support
- [ ] Runtime-agnostic Docker isolation (extending v0.2.0 sandbox to all languages)
- [ ] Streaming output from agents
- [ ] Background agent execution (`agent run --detach`)
- [ ] Semantic version resolution (`^`, `~`)
- [ ] Agent dependency management

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
