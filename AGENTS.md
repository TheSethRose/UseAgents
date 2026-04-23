# UseAgents Agent Guide

## Project focus

UseAgents is a local-first TypeScript CLI for installing, managing, and running versioned AI agents. For product context and user-facing behavior, start with [`README.md`](./README.md). For planned or aspirational behavior, see [`docs/SPEC.md`](./docs/SPEC.md) if present, but prefer the live implementation when docs and code differ.

## Source of truth

- CLI surface and command registration: [`src/index.ts`](./src/index.ts)
- Manifest schema and runtime contract types: [`src/types.ts`](./src/types.ts)
- Command implementations: [`src/commands/`](./src/commands/)
- Shared helpers: [`src/utils/`](./src/utils/)
- Model and tool adapters: [`src/adapters/`](./src/adapters/)
- Public-facing behavior and usage examples: [`README.md`](./README.md)
- Release notes and roadmap: [`CHANGELOG.md`](./CHANGELOG.md)

When documentation conflicts with `src/` or `package.json`, treat the implementation as the source of truth.

## Build and verification

Use the package scripts defined in [`package.json`](./package.json).

- `bun run typecheck` — typecheck src and test files
- `bun run lint` — lint src and test files
- `bun run test` — run the Vitest suite
- `bun run check` — run all three (typecheck + lint + test)
- `bun run build` — required before claiming code changes are complete
- `bun run start` — run the built CLI locally

## Architecture map

- `src/index.ts` wires the Commander-based CLI and registers every command explicitly.
- `src/commands/` contains one file per CLI command or command group.
- `src/types.ts` defines the Zod manifest schema, `AgentContext`, logging types, and install/log record shapes.
- `src/adapters/` contains model and tool adapter logic.
- `src/utils/` contains filesystem, manifest, logging, and error helpers used across commands.
- Agents are installed from the public registry at `registry.useagents.io` or from git URLs.

## Conventions that matter

- This repo is strict-mode TypeScript with ESM output. Keep imports/exports ESM-compatible.
- The current manifest schema in code is authoritative. In particular, keep `runtime.type` aligned with [`src/types.ts`](./src/types.ts) rather than assuming the spec is fully implemented.
- If you add or rename a CLI command, update both the command implementation and its registration in [`src/index.ts`](./src/index.ts).
- If you change public CLI behavior, manifest shape, storage layout, or agent runtime behavior, update the relevant user-facing docs in [`README.md`](./README.md) and note it in [`CHANGELOG.md`](./CHANGELOG.md).
- Preserve backward compatibility for the `run(input, ctx)` contract unless the task explicitly requires a breaking change.
- Treat permission enforcement, manifest validation, and secret handling as security-sensitive paths; prefer reusing existing helpers over introducing parallel logic.

## Practical agent guidance

- Read the relevant command file before editing behavior; most features map cleanly to a single command module plus shared helpers.
- Check published agents via `agent search` before changing manifest or runtime assumptions.
- For storage-path behavior, prefer centralized filesystem utilities rather than hardcoding paths in multiple places.
- Keep changes small and composable; this CLI has clear module boundaries already.

## Related docs

- [`README.md`](./README.md) for setup, CLI usage, storage layout, and security model
- [`CHANGELOG.md`](./CHANGELOG.md) for shipped vs planned behavior
- [`docs/SPEC.md`](./docs/SPEC.md) for MVP intent and future direction
