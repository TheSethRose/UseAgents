# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- `agent login` now validates copied registry session tokens against the public registry session endpoint used by the website settings page.
- `agent login` now writes local registry auth state with user-only file permissions.

## [0.3.6] - 2026-04-24

### Added
- Maintainer documentation now includes `.developer/docs/guides/registry-security-model.md`, a recommended phased security model for opening registry publishing safely.
- Registry security hardening now has phase-1 implementation hooks: namespace/package ACLs, verified-email write gates, immutable version publishing, write audit logs, lifecycle states, canonical artifact URLs, scoped package install support, and CLI checksum/status enforcement.

### Changed
- Documentation now reflects the current split between direct agents and managed integrations.
- CLI docs now include the current command surface: `get`, `upgrade`, `uninstall`, `doctor`, `config`, `login`, and `logout`.
- Registry docs now describe the live Registry API role instead of a local-only website.

### Fixed
- `agent search` output now uses a compact package-manager-style result layout instead of a wide table.

### Known Gaps
- Registry backup/restore for JSON registry data is not implemented yet.
- Registry package authorization still uses the flat-file compatibility layer at runtime while the Prisma-backed package tables are introduced.
- Publish tokens, trusted OIDC publishing, malware scanning, and a complete artifact upload/finalization pipeline are not implemented yet.
- Managed integration listings and detail views still expose wrapper versions in places where users may reasonably read them as the upstream app version; integration UX needs to hide generic version display by default and only surface wrapper versions when explicitly relevant.
- `USEAGENTS_REGISTRY_CACHE_TTL` and `USEAGENTS_OFFLINE` are visible in `agent config` but are reserved for future behavior.

## [0.3.5] - 2026-04-23

### Added
- UseAgents registry API deployed at `https://registry.useagents.io/v1`
- `agent search <query>` command to search the remote registry
- CLI points to `registry.useagents.io/v1` by default (override with `USEAGENTS_REGISTRY` env var)
- Managed integration examples for `goclaw`, `picoclaw`, `pi-mono`, `claude-code`, `gemini-cli`, `qwen-cli`, and `nanoclaw`
- Registry entries for managed integrations and the `hello-world` direct agent

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
- Docker-based sandboxed runtime (optional, per-agent, with resource limits; JavaScript-only for now, multi-runtime in v0.5.0)

### Security
- All file system and network access is now audited
- Permission grants are persisted and validated on each run
- Sandbox mode runs agents in isolated Docker containers with no network access

## [Roadmap]

### 0.4.0 - Registry Publishing Hardening & Discovery UX
- [x] Package ownership and namespace-scoped publishing
- [x] Verified-email publish requirement for registry writes
- [x] Immutable releases with deprecate/yank/quarantine flows
- [x] Registry audit logs for package and version write actions
- [x] Official curated namespace with admin-only publishing
- [x] Restrict community publishing to direct agents until managed integration provenance is in place
- [ ] Hide managed integration version display in search/list/detail output by default so wrapper versions are not mistaken for upstream app versions
- [ ] Improve search with type filters for direct agents vs managed integrations
- [ ] Add a paginated full-list browsing mode for registry entries with next/previous navigation

### 0.5.0 - Multi-Runtime & Isolation
- [ ] Python runtime support (first non-JavaScript runtime)
- [ ] Rust runtime support
- [ ] Runtime-agnostic Docker isolation (extending v0.2.0 sandbox to all languages)
- [ ] Streaming output from agents
- [ ] Background agent execution (`agent run --detach`)
- [ ] Full semantic version range resolution (`^`, `~`)
- [ ] Agent dependency management

### 0.6.0 - IDE Integration
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
