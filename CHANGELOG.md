# Changelog

## v1.1.0

### Added
- Drag-and-drop фото в галерее (менять порядок перетаскиванием)
- Drop файлов из OS на кнопку «Добавить фото» для быстрой загрузки

### Changed
- Рефакторинг upload-actions в usePhotos: вынесен общий хелпер `appendUploadedPhotos`, добавлен `toErrorMessage`
- Выделен shared-тип `DropFileInput` вместо повторяющегося inline-типа

### Fixed
- Оптимистичный reorder теперь откатывается при ошибке API
