# AGENTS.md — coin-collection

## Behavioral rules

- If the user proposes something incorrect, immediately say "Нет, вот правильный вариант:" and give the correct answer — no preambles like "да, почти" or "лучше" or "отличный вариант".

## Project overview

Electron desktop app (React + TypeScript + SQLite) for managing coin collections. Built with `electron-vite`.

## Architecture

```
src/main/        — Electron main process (DB, IPC handlers, export/import logic, LLM chains)
src/preload/     — Context bridge (exposes `window.api`)
src/renderer/    — React UI (components, features, hooks, utils, lib, locales)
src/shared/      — Types and constants shared between main/renderer
```

- **Main process** initializes SQLite (`better-sqlite3`), registers IPC handlers for collections/coins/photos/preferences/backup/export/import/llm, and creates the BrowserWindow.
- **Renderer** communicates with main via `window.api` (preloaded bridge). Tests mock this object.
- **Routing** uses `react-router-dom` with `HashRouter` (suited for Electron's `file://` protocol). Routes defined in `src/renderer/App.tsx`.
- **Database** lives in `src/main/database/` with migrations (V1–V8) and repository pattern.
- **State management**: Zustand 5. Stores are colocated with features (e.g., `features/coins/useCoins.ts`).
- **Styling**: Tailwind CSS. **i18n**: i18next + react-i18next (en/ru).
- **Validation**: Zod for LLM output schemas and import parsing.
- **DnD**: @dnd-kit for photo reordering.

## Features

| Feature | Path | Main process | Renderer |
|---------|------|-------------|----------|
| Collections | `features/collections/` | IPC + repo | CollectionSidebar, CollectionList, CollectionForm, useCollections |
| Coins | `features/coins/` | IPC + repo | useCoins store (pagination), CoinView, CoinList, CoinCard, CoinForm, LlmTools |
| Photos | `features/photos/` | IPC + repo (file copy to userData/photos/) | usePhotos store, PhotoGallery, Lightbox |
| Preferences | IPC `preferences.ts` | repo `preferences.ts` | SettingsModal, currency |
| Backup & Restore | `features/backup/` | IPC + export/import logic | BackupSection, ImportDialog, ProgressModal |
| Export Excel | `features/export/` | IPC + collection-excel.ts | ExportDialog, useExport |
| Export PDF | `features/export-pdf/` | IPC + collection-pdf.ts | ExportPdfDialog, useExportPdf |
| Import spreadsheet | `features/import/` | IPC + xlsx-parser | ImportView |
| AI/LLM | `features/ai/` | IPC + LangChain chains | AiPage, AiCoinCard, AiSettingsModal, useAiStore, queryBulk/querySingle |

## Developer commands

```bash
npm run dev              # Start dev server (electron-vite)
npm run build            # Build for production (outputs to out/)
npm run preview          # Preview production build

npm run lint             # ESLint --fix (TypeScript + React)
npm run format           # Prettier (no semicolons, single quotes, 100 col width)
npm run typecheck        # Runs both typecheck:node and typecheck:web

npm run test             # Vitest run (jsdom env)
npm run test:watch       # Vitest watch mode
npm run test:integration # Integration tests (vitest.integration.config.ts)
npm run test:coverage    # Vitest with coverage (thresholds: 70/60/70/70)
```

### Important: `pretest` rebuilds `better-sqlite3` and `sharp`

The `pretest` hook runs `npm rebuild better-sqlite3`. If native module errors appear during tests, run `npm run rebuild:electron` manually.

### Type checking is split

- `typecheck:node` — main process + preload (uses `tsconfig.node.json`, outputs to `out/main`)
- `typecheck:web` — renderer only (uses `tsconfig.web.json`, no emit)

Run `npm run typecheck` to check both. They have different `lib` targets and JSX settings.

## Path aliases

| Alias      | Resolves to          | Available in       |
| ---------- | -------------------- | ------------------ |
| `@/`       | `src/renderer/`      | renderer, tests    |
| `@shared/` | `src/shared/`        | main, preload, renderer, tests |

## Testing

- **Framework**: Vitest 3 + jsdom + React Testing Library
- **Test files**: `tests/**/*.test.{ts,tsx}` organized by `features/`, `unit/`, `integration/`
- **Setup**: `tests/setup.ts` initializes i18n and mocks `window.api` with vi.fn() stubs
- **Coverage thresholds**: lines 70%, branches 60%, functions 70%, statements 70%
- **Excluded from coverage**: entry points (`src/main/index.ts`, `src/preload/index.ts`, `src/renderer/main.tsx`) and `.d.ts` files

### Writing tests

- Mock `window.api` methods via `vi.mocked(window.api.collections.list).mockResolvedValue(...)` etc.
- Components using `useNavigate` must be wrapped in `<MemoryRouter>`.
- The preload bridge API shape is defined in `src/shared/types/electron-api.ts` — keep mocks in sync.
- **mountedRef guard**: when testing components that use `useRef(true)` for unmount protection, ensure the effect body resets the ref (`mountedRef.current = true`), otherwise React 18 Strict Mode double-invocation will leave it `false`.

## Code style

- **NEVER commit without explicit command.** After completing a task, only run `lint`, `typecheck`, and `test`. Show the user `git status` and `git diff` so they can review before committing.
- **Commit only when asked.** The user will run `git add` and `git commit` themselves.
- **ESLint**: `@typescript-eslint/recommended` + `react/recommended` + `react-hooks/recommended` + `prettier`
- **Prettier**: `semi: false`, `singleQuote: true`, `trailingComma: none`, `printWidth: 100`
- Unused vars: `argsIgnorePattern: '^_'`, `caughtErrors: 'none'`
- `no-explicit-any`: warn (not error)
- **SVG icons**: never inline SVG markup in components. Always create a separate file in `src/renderer/components/ui/icons/` and import it.
- **i18n**: all user-facing strings must use `t()` from `react-i18next`. Never hardcode English text in components. Add keys to `en.json`, `ru.json`, and `tests/setup.ts`.

## Build & distribution

- `npm run dist:mac` — macOS (dmg + zip, hardened runtime)
- `npm run dist:win` — Windows (nsis + portable)
- `npm run dist:all` — both platforms
- Output: `dist/` directory (configured in `electron-builder.yml`)

## Gotchas

- **`better-sqlite3` is a native module** — requires rebuild after `npm install` or Node version changes. Handled by `postinstall` and `pretest` hooks.
- **Preload file extension is `.mjs`** — output is `out/preload/index.mjs`, not `.js`. The main process references `../preload/index.mjs`.
- **Native module architecture** — `postinstall` and `rebuild:electron` target `--arch arm64` by default. If running on x64, adjust the arch flag.
- **Database files** (`*.db`, `*.sqlite`) are gitignored. Each dev instance creates its own.
- **`out/` is the build output** — don't edit files there; they're generated by `electron-vite build`.
