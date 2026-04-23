# Contributing to UseAgents CLI

This package contains the `agent` CLI published as `@thesethrose/useagents`.

## Getting Started

```bash
git clone https://github.com/thesethrose/useagents.git
cd useagents/cli
npm install
npm run check
npm run build
```

There is no root package script for the CLI. Run all CLI commands from `cli/`.

## Development Workflow

1. Create a branch for the fix or feature.
2. Read the command, helper, or adapter you are changing before editing.
3. Keep direct agents and managed integrations separate:
   - Direct agents install runnable code and have `agent.yaml` manifests.
   - Managed integrations orchestrate third-party installers and are tracked in `integrations.json`.
4. Update tests and docs when behavior changes.
5. Run the smallest meaningful checks before opening a PR.

## Verification

```bash
npm run typecheck
npm run lint
npm run test
npm run check
npm run build
```

For manual smoke tests, build first and then use:

```bash
node dist/index.js --help
node dist/index.js search hello
```

Do not use `tsx src/index.ts` for CLI smoke tests; the CLI intentionally rejects invocation names that are not declared binaries.

## Pull Request Guidelines

- Describe the user-facing behavior that changed.
- Call out any changes to manifest shape, storage layout, registry contract, or install semantics.
- Add or update tests for command behavior, registry contract drift, permission handling, and manifest validation.
- Avoid new production dependencies unless they are required for correctness.

## Code Style

- Use TypeScript for new source and tests.
- Follow existing command-per-file structure in `src/commands/`.
- Prefer shared helpers in `src/utils/` over duplicated filesystem, registry, or formatting logic.
- Add comments only when they explain non-obvious behavior.

## Reporting Issues

Include:

- The exact `agent` command run
- Expected and actual output
- OS, shell, Node.js version, and installed CLI version
- Relevant `USEAGENTS_*` environment variables
- Whether the issue involves a direct agent or a managed integration

## License

By contributing to UseAgents, you agree that your contributions will be licensed under the MIT License.
