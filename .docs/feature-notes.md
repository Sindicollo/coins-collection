# Feature: Coin Notes CRUD

## Goal

Replace single `notes` text field on coins with a full CRUD system for multiple notes per coin. Each note has a title, content, created_at, and updated_at.

## UI Design

- **CoinDetailPage** — отдельная страница (`/coins/:collectionId/coin/:coinId`) внутри `AppLayout` (sidebar visible)
- **Vertical tabs** слева: Детали | Заметки (N) | Фото (N)
- Tab "Заметки": список карточек заметок с inline-созданием/редактированием
- AI кнопки рядом с "+ Добавить заметку": "🔍 eBay Prices", "📊 Coin Info"
- AI запросы создают **новые** заметки (title="AI: eBay Prices" и т.д.)
- CoinForm (модал) открывается по кнопке "Редактировать" на табе "Детали", без поля notes

## Note Card Display

- Если есть title → показать title
- Если title пустой → показать первые ~50 символов content
- Дата создания/модификации под заголовком
- Preview первых ~100 символов content
- Кнопки: ✏️ редактировать, 🗑️ удалить

## Database Schema

### New table: `coin_notes`

```sql
CREATE TABLE coin_notes (
  id TEXT PRIMARY KEY,
  coin_id TEXT NOT NULL REFERENCES coins(id) ON DELETE CASCADE,
  title TEXT,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_coin_notes_coin ON coin_notes(coin_id, updated_at DESC);
```

### Migration V9

1. Create `coin_notes` table
2. For each coin with non-null `notes`, insert a row into `coin_notes` (title=NULL, content=notes)
3. `ALTER TABLE coins DROP COLUMN notes`

## Implementation Plan

### Phase 1: Database + Backend

| # | File | Action |
|---|------|--------|
| 1.1 | `src/shared/types/coin-note.ts` **(new)** | `CoinNote`, `CreateCoinNoteInput`, `UpdateCoinNoteInput` |
| 1.2 | `src/shared/types/coin.ts` | Remove `notes` from `Coin`, `CreateCoinInput`, `UpdateCoinInput` |
| 1.3 | `src/shared/types/index.ts` | Export new types |
| 1.4 | `src/shared/types/electron-api.ts` | Add `notes` namespace to `ElectronAPI` |
| 1.5 | `src/main/database/migrations.ts` | V9 migration |
| 1.6 | `src/main/database/repositories/coin-notes.ts` **(new)** | CRUD: `list`, `get`, `create`, `update`, `delete`, `countByCoin` |
| 1.7 | `src/main/database/repositories/coins.ts` | Remove `notes` from all SQL and mappings |
| 1.8 | `src/main/database/repositories/export.ts` | Update queries (JOIN coin_notes or remove notes) |
| 1.9 | `src/main/ipc/coin-notes.ts` **(new)** | IPC handlers |
| 1.10 | `src/main/index.ts` | `registerCoinNoteHandlers()` |
| 1.11 | `src/main/llm/chains.ts` | Rewrite `bulkAppendLlmInfo` → `createCoinNote` |
| 1.12 | `src/preload/index.ts` | Add `api.notes` |
| 1.13 | `src/main/import/backup.ts` | Update backup/restore for coin_notes |
| 1.14 | `src/main/import/xlsx-parser.ts` | Remove `notes` from parser |
| 1.15 | `src/main/export/collection-excel.ts` | Update export |
| 1.16 | `src/main/export/collection-pdf.ts` | Update export |

### Phase 2: Routing — CoinDetailPage

| # | File | Action |
|---|------|--------|
| 2.1 | `src/renderer/App.tsx` | Add route `/coins/:collectionId/coin/:coinId` |
| 2.2 | `src/renderer/features/coins/CoinCard.tsx` | `onSelect` → `navigate(.../coin/${coin.id})` |
| 2.3 | `src/renderer/features/coins/CoinView.tsx` | Remove edit modal state (moved to CoinDetailPage) |

### Phase 3: UI — Tabs + CoinDetailPage

| # | File | Action |
|---|------|--------|
| 3.1 | `src/renderer/components/ui/Tabs.tsx` **(new)** | Vertical tabs component |
| 3.2 | `src/renderer/components/ui/icons/Note.tsx` **(new)** | Note icon SVG |
| 3.3 | `src/renderer/features/coins/CoinDetailPage.tsx` **(new)** | Page with tabs, loads coin by `coinId` |
| 3.4 | `src/renderer/features/coins/CoinDetailForm.tsx` **(new)** | Tab "Детали": read-only + Edit button |
| 3.5 | `src/renderer/features/notes/CoinNotesList.tsx` **(new)** | Tab "Заметки": list + add + AI buttons |
| 3.6 | `src/renderer/features/notes/CoinNoteCard.tsx` **(new)** | Note card with expand/edit/delete |
| 3.7 | `src/renderer/features/notes/useCoinNotes.ts` **(new)** | Zustand store or hooks for notes |
| 3.8 | Photo tab | Reuse/adapt existing PhotoGallery |

### Phase 4: Migrate existing code

| # | File | Action |
|---|------|--------|
| 4.1 | `src/renderer/features/coins/CoinForm.tsx` | Remove `notes` field |
| 4.2 | `src/renderer/features/ai/AiCoinCard.tsx` | `onAppendToNotes` → `api.notes.create` |
| 4.3 | `src/renderer/features/ai/AiPage.tsx` | Update `handleCoinUpdated` |

### Phase 5: i18n

| # | File | Action |
|---|------|--------|
| 5.1 | `src/renderer/locales/en.json` | Add `notes.*`, `tabs.*` keys |
| 5.2 | `src/renderer/locales/ru.json` | Add `notes.*`, `tabs.*` keys |
| 5.3 | `tests/setup.ts` | Add same keys for tests |

### Phase 6: Tests

| # | File | Action |
|---|------|--------|
| 6.1 | `tests/unit/coin-notes-repo.test.ts` **(new)** | Repository tests |
| 6.2 | `tests/features/notes/CoinNotesList.test.tsx` **(new)** | UI tests |
| 6.3 | Existing tests | Update mocks (remove `notes` from `mockCoin`) |
