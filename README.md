# 🪙 Coin Collection

A desktop app for managing your coin collection — built as a hobby project.
English/russian interface.

![Coin Collection Screenshot](coin%20collection%20screenshot.png)

## Features

- **Collections** — organize coins into custom collections (e.g. "Russian Coins", "British Shillings")
- **Coins** — track denomination, year, condition, purchase date, price, currency, notes, sold status, and more
- **Photos** — attach multiple photos to each coin, reorder them, and browse in a lightbox
- **Export to PDF** — export selected collections with coin details, photos (up to 4 per coin), table of contents, and «Sold» label in red
- **Export to Excel** — export selected collections to `.xlsx` with embedded photos
- **Import** — bulk import coins from Excel `.xlsx` spreadsheets
- **Backup & Restore** — export your entire database to a ZIP archive (JSON + photos), import back with smart merge
- **i18n** — English and Russian UI
- **Offline-first** — all data stored locally in SQLite, no cloud required

## Download

[**Download .dmg**](https://github.com/Sindicollo/coins-collection/releases/download/v1.2.0/Coin.Collection-1.2.0-arm64.dmg) (macOS arm64, ~110 MB)

> See [Releases](https://github.com/Sindicollo/coins-collection/releases) for other versions.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop | [Electron](https://www.electronjs.org/) 33 |
| Bundler | [electron-vite](https://electron-vite.org/) 2 |
| Frontend | [React](https://react.dev/) 18 + [TypeScript](https://www.typescriptlang.org/) 5 |
| Styling | [Tailwind CSS](https://tailwindcss.com/) 3 |
| State | [Zustand](https://zustand-demo.pmnd.rs/) 5 |
| Database | [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) 11 |
| Routing | [React Router](https://reactrouter.com/) 7 |
| i18n | [i18next](https://www.i18next.com/) + [react-i18next](https://react.i18next.com/) |
| Testing | [Vitest](https://vitest.dev/) + [React Testing Library](https://testing-library.com/) |
| Linting | [ESLint](https://eslint.org/) + [Prettier](https://prettier.io/) |
| Build | [electron-builder](https://www.electron.build/) 25 |
| Backup | [adm-zip](https://github.com/cthackers/adm-zip) |
| Import | [SheetJS (xlsx)](https://sheetjs.com/) |
| Export (Excel) | [ExcelJS](https://github.com/exceljs/exceljs) |
| Export (PDF) | [PDFKit](https://pdfkit.org/) |
| Images | [sharp](https://sharp.pixelplumbing.com/) |

## Architecture

```
src/main/        — Electron main process (database, IPC handlers)
src/preload/     — Context bridge (exposes window.api)
src/renderer/    — React UI (components, features, hooks, styles, locales)
src/shared/      — Types and constants shared between main/renderer
```

**Database:** SQLite via `better-sqlite3` with migrations. Photos are stored as files in the app's `userData` directory and referenced by filename in the DB.

**IPC:** The renderer communicates with the main process through `window.api` — a type-safe bridge exposed via Electron's `contextBridge`.

## Development

```bash
# Install dependencies
npm install

# Start dev server with hot reload
npm run dev

# Type checking
npm run typecheck

# Lint (auto-fix)
npm run lint

# Run tests
npm test

# Build for production
npm run build
```

### Requirements

- Node.js 20+
- macOS (arm64) or Windows (x64)
- For native module rebuilds: `npm run rebuild:electron`

## License

MIT — this is a hobby project, use it however you like.
