# AGENTS.md

This file is for autonomous coding agents working in this repository.

## Repo snapshot

- Stack: React + TypeScript + Vite (ESM)
- UI styling: Tailwind (via `@import "tailwindcss"` in `src/index.css`)
- Game architecture: React UI shell + vanilla canvas engine (see `Design.md`)

Key paths:
- `src/components/Game.tsx`: React UI layer (overlays, fullscreen, orientation)
- `src/game/Engine.ts`: core game loop / input / collisions
- `src/game/engine/GameEngine.ts`: engine implementation (owns UI snapshot + subscriptions)
- `src/game/Entities.ts`: entities (Player, enemies, projectiles, particles, etc.)
- `src/game/physics/TileSpatialIndex.ts`: tile broadphase candidate queries
- `src/components/ui/*`: Cyber UI component library (see `UIDesign.md`)

## Build / lint / test

### Prereqs

- Node.js installed (no `.nvmrc` / `.node-version` present)

### Install

```sh
npm install
```

### Environment

- Copy patterns from `.env.example`.
- Do **not** commit secrets. `.gitignore` ignores `.env*` and whitelists `.env.example`.

Expected variables (see `.env.example`): `APP_URL`.

### Run (dev)

`package.json` currently defines:

```sh
npm run dev
```

Notes: script is `tsx server.ts`, but there is **no `server.ts` in the repo root** currently.

### Build

```sh
npm run build
```

- Runs `vite build`.

### Preview built app

```sh
npm run preview
```

- Runs `vite preview` (requires `npm run build` first).

### Deploy (public)

- During development, **after each change is made**, deploy the latest build so it is publicly accessible on **port `13002`**.
  - 中文：项目开发过程中，每次修改完都需要部署到公网 **13002** 端口。

### Lint (typecheck)

```sh
npm run lint
```

- This repo uses TypeScript typechecking as “lint”: `tsc --noEmit`.

### Tests

- No test runner is configured (no `test` script, no `*.test.*` / `*.spec.*`, no Jest/Vitest/Playwright/Cypress config).

#### Run a single test

- Not applicable until a test runner is added.

## Local development notes (Vite / AI Studio)
- HMR can be disabled via `DISABLE_HMR` (`vite.config.ts` comment); avoid changing this behavior unless you understand the AI Studio runtime constraints.
- Path alias `@` is configured in both `tsconfig.json` and `vite.config.ts`, but current source code primarily uses relative imports.

## Code style (follow existing repo conventions)

There is no ESLint/Prettier/EditorConfig in the repo, so style is mostly “by convention”.
When editing a file, match its existing style. Defaults below reflect dominant patterns.

### Formatting

- Indentation: 2 spaces.
- Semicolons: used throughout; keep them.
- Quotes:
  - Prefer single quotes in TS/TSX for imports and most strings.
  - JSX attributes / Tailwind class strings commonly use double quotes.
- Trailing commas: present in some multi-line expressions; keep the local pattern.

### Imports

- ESM modules (repo is `"type": "module"`).
- Common ordering pattern:
  1) React / external deps
  2) internal modules (`../game/*`, `./ui`, etc.)
  3) styles (`./index.css`)
- UI components should be imported from the barrel export:
  - `src/components/ui/index.ts` exports `Cyber*` components.
  - Prefer `import { CyberButton, ... } from './ui';` over deep relative paths.

### TypeScript

- Prefer explicit types at module boundaries:
  - Props interfaces (`ComponentNameProps`)
  - callback signatures (`onStateChange?: (state: ...) => void`)
- Prefer string-literal unions for finite states (e.g. `'START' | 'PLAYING' | 'GAME_OVER'`).
- Avoid non-null assertions (`!`) unless truly safe and localized.

#### Absolutely avoid type suppression

- Do not introduce `as any`, `null as any`, `@ts-ignore`, `@ts-expect-error`.
- This repo currently has a couple `as any` usages in the engine layer; treat them as legacy tech debt and avoid copying the pattern.

### Naming

- Components/classes: PascalCase (`CyberButton`, `GameEngine`).
- Variables/functions: camelCase (`toggleFullscreen`, `checkOrientation`).
- Booleans: `is*`, `has*`, `show*`.
- UI labels and game state values often use uppercase strings for aesthetic consistency.

### Error handling / logging

- Use guard clauses for invalid states (common in engine code).
- Wrap browser APIs that can throw/reject in `try/catch` (e.g. fullscreen toggling).
- No empty `catch` blocks.
- Prefer `console.error` for unexpected failures in UI flows; keep logs actionable.

## UI / Tailwind guidelines (must follow)

See `UIDesign.md` for the canonical design system.

Hard rules:

- No soft curves: **never use Tailwind `rounded-*` classes**.
- Use chamfer utilities instead: `.clip-chamfer` / `.clip-chamfer-sm` (defined in `src/index.css`).
- Use semantic cyber tokens from `src/index.css` (colors/fonts) rather than random hex values.

Composition rules:

- Prefer existing primitives (`CyberPanel`, `CyberText`, `CyberButton`, `CyberModal`, etc.) over bespoke HTML.
- Use glow sparingly (glow is visually heavy).
- For overlays: `bg-black/60 backdrop-blur-sm` + centered `CyberPanel` is the default pattern.
- Data labels should look “terminal-like”: `font-mono uppercase tracking-widest`.

## UI ↔ Engine state (no polling)

- Do **not** add `setInterval`/polling loops to keep overlay state in sync.
- Use the engine UI external-store API instead:
  - `engine.subscribeUi(listener): () => void`
  - `engine.getUiSnapshot(): EngineUiSnapshot`
- In React, consume it via `useSyncExternalStore`.

## i18n (EN/中文) technical spec

This repo uses a lightweight, type-safe i18n layer.

- Source of truth: `src/i18n/translations.ts`
  - `en` defines the keyset (`TranslationKey = keyof typeof en`).
  - `zh` must include **every** key in `en` (TypeScript enforces this).
  - Keep keys stable (`section.name` style).

- Translation API:
  - `translate(language, key, vars?)` in `src/i18n/translate.ts` supports `{var}` interpolation.
  - React usage: `useI18n()` from `src/i18n/react.tsx` provides `{ language, setLanguage, t }`.
  - `I18nProvider` persists language in `localStorage` (`language`) and sets `<html lang>`.

- UI rules:
  - All **player-facing UI strings** must go through `t(...)` / `translate(...)`.
  - **Debug panel stays hardcoded English** (do not translate debug UI).

- Engine / canvas HUD rules:
  - Canvas HUD text is rendered in `src/game/renderer/Renderer.ts` and uses `translate(engine.language, ...)`.
  - React should call `engine.setLanguage(language)` when language changes.
  - Avoid embedding localized names in core combat logic; keep IDs stable and translate at the boundary (UI / HUD).

## Cursor / Copilot rules

- No Cursor rules found (`.cursorrules` or `.cursor/rules/`).
- No GitHub Copilot instructions found (`.github/copilot-instructions.md`).

## Common gotchas

- `npm run dev` references a missing `server.ts`.
- `npm run start` expects `dist/server.cjs`; verify build output before relying on it.
- There are currently no automated tests.
