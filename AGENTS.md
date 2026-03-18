# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

EnsoAI is a single-package Electron desktop app (Git Worktree manager + AI coding agents). There are no backend servers, databases, or Docker services — everything runs locally in one Electron process.

### Dev commands

Standard commands are in `package.json` scripts:

| Command | Purpose |
|---|---|
| `pnpm dev` | Start Electron in dev mode (electron-vite dev) |
| `pnpm build` | Production build (electron-vite build) |
| `pnpm lint` | Biome linting (`biome check .`) |
| `pnpm typecheck` | TypeScript type-checking (`tsc --noEmit`) |

### Running on headless Linux (Cloud VM)

Electron requires a display server. On the Cloud VM a TigerVNC server is already available on `:1`. When launching `pnpm dev`, ensure `DISPLAY` is set:

```bash
export DISPLAY=:1
pnpm dev
```

D-Bus and GPU-process warnings in the console are expected and harmless — Electron falls back to software rendering.

### Lint baseline

`pnpm lint` currently exits with code 1 due to pre-existing Biome warnings in the codebase (schema version mismatch and minor lint findings). This is not a failure introduced by setup.

### Native modules

`node-pty` and `@parcel/watcher` are compiled from source during `pnpm install`. The `postinstall` script runs `electron-rebuild` to ensure they match Electron's Node ABI. If you see build failures during install, verify that `gcc`, `g++`, `make`, and `python3` are available.

### Pre-commit hooks

Husky runs `lint-staged` on commit, which executes `biome check --write --no-errors-on-unmatched` on staged `*.{js,ts,jsx,tsx,json,css}` files.
