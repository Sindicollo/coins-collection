# Changelog

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
