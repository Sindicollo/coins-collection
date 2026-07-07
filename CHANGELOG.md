# Changelog

## v1.5.0

### Added
- Multiple notes per coin — separate notes table with titles, editing, and delete
- AI query results saved as coin notes (eBay prices, coin info, mintage)
- Notes tab on coin detail page (alongside Details and Photos)
- Back button to navigate from coin detail page to parent collection

### Changed
- Settings reorganized into two tabs: General (language, currency) and AI
- Actions (backup, export) moved to a separate dropdown in the header
- Language switcher moved from header to Settings → General tab
- Settings and Actions buttons now use consistent styling (icon + text label)
- Sticky header in coin list when scrolling
- Improved backup import: legacy coin notes migrated to the new notes table

### Fixed
- Scroll position was lost when navigating back from a coin to the list
- Notes without titles could not be expanded ("Read more" button was missing)
- Excel export formula injection prevented for note content
- Code quality: error handling, cursor cleanup, and element unmount race conditions

## v1.4.0

### Added
- Auction support — coins can be marked "on auction" with an auction price
- Sold price field — separate `salePrice` stored and displayed alongside the sold flag
- AUC icon rotated -45° on auction coin cards (orange)
- SOLD icon rotated -45° on sold coin cards (green)
- Auction and sale prices shown inline in the coin card top row
- Auction checkbox and price fields in the coin edit form
- Sold price field in the coin edit form (shown when sold is checked)
- Auction/sale columns in Excel export
- Auction/sale info in PDF export
- Auction/sale fields in backup import

### Changed
- SOLD icon takes visual precedence over AUC — when a coin is sold, only SOLD is shown
- Orange auction card background suppressed when the coin is sold
- `opacity-60` instead of `opacity-60 grayscale` for sold cards — sale price text stays green
- Icon containers moved outside the opacity/grayscale wrapper so they retain full color visibility

### Fixed
- `salePrice` was silently dropped when saving a coin via the form (CoinSaveData missing the field)
- BackupCoin interface now includes optional `onAuction`, `auctionPrice`, `salePrice` fields
- PDF export handles `undefined` new fields gracefully with `!= null` checks
- Test fixtures updated with required `onAuction`, `auctionPrice`, `salePrice` fields

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
