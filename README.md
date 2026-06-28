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

| Platform | Link |
|----------|------|
| **macOS** (arm64) | [Download .dmg](https://github.com/Sindicollo/coins-collection/releases/download/v1.4.0/Coin-Collection-1.4.0-arm64.dmg) (~114 MB) |
| **Windows** (x64) | [Download Setup](https://github.com/Sindicollo/coins-collection/releases/download/v1.4.0/Coin-Collection-Setup-1.4.0.exe) (~91 MB) — [Portable](https://github.com/Sindicollo/coins-collection/releases/download/v1.4.0/Coin-Collection-1.4.0.exe) |

> ⚠️ **Windows builds are not tested.** The app is developed and tested on macOS only. Windows binaries are built via GitHub Actions but may contain platform-specific issues. Bug reports welcome!

### macOS Installation

The app is **unsigned** (no Apple Developer ID). macOS Gatekeeper will block it on first launch with the message *"Coin Collection is damaged and can't be opened."* To fix this, remove the quarantine flag after copying to `/Applications`:

```bash
# After dragging the app from the .dmg to /Applications:
xattr -cr /Applications/Coin\ Collection.app
# Then open normally from Finder or Spotlight
```

Alternatively, you can **right-click → Open** the app in Finder, then click "Open" in the dialog — this works once per downloaded version.

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
