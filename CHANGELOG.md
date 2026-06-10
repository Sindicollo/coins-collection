# Changelog

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
