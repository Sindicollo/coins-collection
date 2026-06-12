# Changelog

## v1.3.0

### Added
- LLM prompt template — copy-paste ready prompt for ChatGPT/Claude with collection JSON
- LLM prompt template translated to Russian when UI language is Russian
- Tooltips on Export/Import buttons explaining the LLM workflow
- `HelpTooltip` component (reusable CSS tooltip)

### Changed
- **LLM Import refactored**: renamed from "Import prices" to generic LLM tools (`LlmTools`)
- Import field changed from `prices` to `info` — supports any LLM query, not just prices
- No `prices:` prefix when appending LLM output to coin notes
- Ghost button hover changed to blue tint
- LLM buttons repositioned next to "Add Coin" button for more title space
- Shared `LlmExportCoin` type (deduplicated from main and renderer)

### Fixed
- IPC crash protection: `readFileSync`/`JSON.parse` wrapped in try/catch
- Clipboard fallback replaced with proper error handling (Electron context)
- `setTimeout` cleanup on unmount for copy button state
- Windows path separator in exported filename display
- GitHub Actions: force Node.js 24 for actions runner

## v1.2.2

### Fixed
- macOS: app no longer blocked by Gatekeeper (disabled hardenedRuntime for unsigned builds)
- macOS: sharp native module properly included in packaged app (extraResources)
- Reduced DMG size from 251 MB to 122 MB

## v1.2.1

### Added
- Windows build via GitHub Actions (NSIS installer + portable)
- GitHub Actions release workflow triggered on tag push
- opencode skill for creating releases

### Changed
- Fixed node-gyp compatibility for Windows builds (Node 20.20.2)
- README: added Windows download section with untested notice

## v1.2.0

### Added
- Export to PDF — selected collections with coins, photos, table of contents, red "Sold" label
- Export to Excel (.xlsx) — selected collections with metadata and embedded photos
- Collection selection dialog with per-format export options
- Cyrillic support in PDF (DejaVu Sans font)

### Changed
- Export refactoring: shared data collection and IPC logic extracted into shared modules
- Excel tests rewritten as pure unit tests (no real SQLite)

## v1.1.0

### Added
- Drag-and-drop photo reordering in the gallery
- Drop files from OS onto the "Add Photo" button for quick upload

### Changed
- Refactored upload actions in usePhotos: extracted shared helper `appendUploadedPhotos`, added `toErrorMessage`
- Extracted shared type `DropFileInput` instead of duplicated inline type

### Fixed
- Optimistic reorder now rolls back on API error
