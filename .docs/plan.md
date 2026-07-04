# Coin Collection Desktop App — План / Текущее состояние

## Технологический стек

| Компонент | Технология | Версия |
|-----------|------------|--------|
| Desktop | Electron | 33.x |
| Bundler | Vite (electron-vite) | 2.x |
| Frontend | React | 18.x |
| Type System | TypeScript + Zod | 5.x / 4.x |
| Styling | Tailwind CSS | 3.x |
| State | Zustand | 5.x |
| Routing | react-router-dom (HashRouter) | 7.x |
| Database | better-sqlite3 | 11.x |
| i18n | i18next + react-i18next | 26.x / 17.x |
| DnD | @dnd-kit | 6.x / 10.x |
| Export | exceljs + pdfkit | 4.x / 0.x |
| Import | xlsx + adm-zip | 0.x / 0.x |
| AI/LLM | @langchain/core + @langchain/openai | 1.x |
| Images | sharp | 0.x |
| Testing | Vitest + Testing Library + jsdom | 3.x |
| Linting | ESLint + Prettier | 8.x / 3.x |
| Builder | electron-builder | 25.x |

## Архитектура данных

### Схема SQLite (v8)

```sql
CREATE TABLE collections (
  id TEXT PRIMARY KEY,              -- UUID
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE coins (
  id TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  denomination TEXT NOT NULL,
  year INTEGER,
  condition TEXT,                   -- UNC, AUNC, XF+, XF, VF+, VF, F, VG, G, F-2, F-1
  composition TEXT,                 -- gold, silver, billon, copper, bronze, other
  purchase_date INTEGER,
  purchase_place TEXT,
  price REAL,
  shipping_cost REAL,
  currency TEXT,                    -- RUB, USD, EUR...
  country TEXT,                     -- freeform country override
  notes TEXT,
  extra_data TEXT,                  -- JSON for custom fields
  sold INTEGER NOT NULL DEFAULT 0,
  on_auction INTEGER NOT NULL DEFAULT 0,
  auction_price REAL,
  sale_price REAL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE photos (
  id TEXT PRIMARY KEY,
  coin_id TEXT NOT NULL REFERENCES coins(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  original_name TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE preferences (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE _migrations (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
);

CREATE INDEX idx_coins_collection ON coins(collection_id, denomination, year, id);
CREATE INDEX idx_photos_coin ON photos(coin_id, position);
```

### История миграций

| V | Изменение |
|---|-----------|
| 1 | Initial: collections, coins, photos |
| 2 | Currency support + preferences table |
| 3 | Coin.country (freeform) |
| 4 | Rename countries → collections, country_id → collection_id |
| 5 | Coin.sold flag |
| 6 | Coin.composition (metal) |
| 7 | Coin.on_auction + auction_price |
| 8 | Coin.sale_price |

### Файловая структура данных

```
~/Library/Application Support/coin-collection/
├── database.sqlite
└── photos/
    ├── {uuid}.jpg
    └── {uuid}_thumb.jpg
```

### Курсорная пагинация

```typescript
interface CursorParams {
  collectionId: string
  cursor?: string    // base64(denomination + year + id)
  limit: number      // default 20
}

interface PaginatedResult<T> {
  items: T[]
  nextCursor: string | null
  hasMore: boolean
}
```

## Структура проекта

```
coin-collection/
├── src/
│   ├── main/                         # Electron main process
│   │   ├── index.ts                  # Entry: window, DB init, IPC registration
│   │   ├── database/
│   │   │   ├── index.ts              # DB singleton (better-sqlite3)
│   │   │   ├── migrations.ts         # V1–V8 sequential migrations
│   │   │   └── repositories/
│   │   │       ├── coins.ts          # CoinRepository
│   │   │       ├── collections.ts    # CollectionRepository
│   │   │       ├── photos.ts         # PhotoRepository
│   │   │       ├── preferences.ts    # PreferencesRepository
│   │   │       ├── export.ts         # ExportRepository (read-all queries)
│   │   │       ├── uuid.ts           # UUID generation
│   │   │       └── index.ts          # barrel
│   │   ├── ipc/                      # IPC handlers (ipcMain.handle)
│   │   │   ├── coins.ts
│   │   │   ├── collections.ts
│   │   │   ├── photos.ts
│   │   │   ├── preferences.ts
│   │   │   ├── backup.ts
│   │   │   ├── export.ts             # Excel export
│   │   │   ├── export-pdf.ts         # PDF export
│   │   │   ├── export-common.ts      # Shared export IPC
│   │   │   ├── import.ts             # Spreadsheet import
│   │   │   └── llm.ts                # AI queries, export/import for LLM
│   │   ├── export/
│   │   │   ├── backup.ts             # Backup ZIP creation + restore
│   │   │   ├── collection-excel.ts   # Excel workbook generation
│   │   │   ├── collection-pdf.ts     # PDF document generation
│   │   │   ├── common.ts             # Shared export utilities (photos, formatting)
│   │   │   ├── l10n.ts               # Export localization
│   │   │   └── types.ts
│   │   ├── import/
│   │   │   ├── backup.ts             # ZIP restore logic
│   │   │   ├── spreadsheet-import.ts # Spreadsheet import logic
│   │   │   └── xlsx-parser.ts        # XLSX/CSV parser
│   │   └── llm/
│   │       ├── chains.ts             # LangChain chains for numismatic queries (prices/mintage/info)
│   │       ├── config.ts             # LLM configuration (OpenRouter, LM Studio, Ollama)
│   │       ├── providers.ts          # Provider setup (OpenAI-compatible)
│   │       └── schemas.ts            # Zod schemas for LLM output validation
│   ├── preload/                      # Context bridge
│   │   ├── index.ts                  # Exposes window.api
│   │   └── index.d.ts               # Global Window type augmentation
│   ├── renderer/                     # React app
│   │   ├── main.tsx
│   │   ├── App.tsx                   # Routes: /, /coins/:collectionId/photo/:coinId, /ai/:collectionId
│   │   ├── env.d.ts
│   │   ├── global-api.ts
│   │   ├── components/
│   │   │   ├── ui/                   # Button, Card, Input, Modal, Skeleton, Autocomplete, HelpTooltip
│   │   │   │   └── icons/           # SVG icons (Ai, Arrow, Coin, Delete, Edit, Globe, Photo, Plus, Settings, etc.)
│   │   │   ├── layout/
│   │   │   │   ├── AppLayout.tsx     # Sidebar + header + content
│   │   │   │   └── Header.tsx        # Top bar (search, add, settings, AI, export)
│   │   │   └── common/
│   │   │       ├── SettingsModal.tsx  # Preferences (currency, language, backup, import)
│   │   │       └── LanguageSwitcher.tsx
│   │   ├── features/
│   │   │   ├── collections/          # CollectionSidebar, CollectionForm, CollectionList, useCollections, api
│   │   │   ├── coins/                # CoinView, CoinList, CoinCard, CoinForm, useCoins, useScrollRestoration, LlmTools (export/import для AI), api
│   │   │   ├── photos/               # PhotoGallery, Lightbox, usePhotos, api
│   │   │   ├── ai/                   # AiPage, AiCoinCard, AiSettingsModal, useAiStore, api
│   │   │   ├── export/               # ExportDialog (Excel), useExport
│   │   │   ├── export-pdf/           # ExportPdfDialog, useExportPdf
│   │   │   ├── backup/               # BackupSection, ImportDialog, ProgressModal
│   │   │   └── import/               # ImportView (spreadsheet)
│   │   ├── hooks/
│   │   │   └── useIntersectionObserver.ts
│   │   ├── lib/
│   │   │   └── i18n.ts               # i18next init (en/ru)
│   │   ├── locales/
│   │   │   ├── en.json
│   │   │   └── ru.json
│   │   └── utils/
│   │       └── currency.ts           # Currency formatting
│   └── shared/                       # Shared between all processes
│       ├── types/
│       │   ├── index.ts              # Result<T>, ErrorResult, PaginatedResult, LlmExportCoin
│       │   ├── collection.ts
│       │   ├── coin.ts               # Coin, CoinCondition, CoinComposition, CreateCoinInput, UpdateCoinInput
│       │   ├── photo.ts
│       │   ├── electron-api.ts       # ElectronAPI interface
│       │   ├── backup.ts
│       │   └── llm.ts                # LLM-related types
│       └── constants/
│           └── index.ts
├── resources/                        # Static assets (app icon)
├── tests/
│   ├── setup.ts                      # i18n init + window.api mocks
│   ├── unit/                         # Repository, utility tests
│   │   ├── smoke.test.ts
│   │   ├── backup.test.ts
│   │   ├── collection-excel.test.ts
│   │   ├── collection-pdf.test.ts
│   │   ├── common.test.ts
│   │   └── xlsx-parser.test.ts
│   ├── features/                     # Feature-level tests (organized by feature)
│   │   ├── coins/                    # CoinCard, CoinView, LlmTools, useCoins, useScrollRestoration
│   │   ├── collections/             # CollectionForm, CollectionList, useCollections
│   │   ├── photos/                  # Lightbox, PhotoGallery, usePhotos
│   │   ├── export/                  # ExportDialog, useExport
│   │   └── export-pdf/              # ExportPdfDialog, useExportPdf
│   └── integration/                  # End-to-end integration tests
│       └── backup.test.ts
├── .github/workflows/
│   ├── test.yml                      # CI: lint, typecheck, test
│   └── release.yml                   # Build + GitHub release on tag
├── package.json
├── electron-builder.yml
├── electron.vite.config.ts
├── vitest.config.ts
├── vitest.integration.config.ts
├── tsconfig.json
├── tsconfig.node.json                # Main + preload (ES2023, Node)
├── tsconfig.web.json                 # Renderer (ES2020, DOM, JSX)
├── .eslintrc.cjs
├── tailwind.config.js
└── postcss.config.js
```

## Фичи (текущее состояние)

### ✅ Реализовано

- **Коллекции** (ex-Страны) — CRUD в сайдбаре, выбор
- **Монеты** — CRUD, курсорная пагинация, группировка (коллекция → номинал → год)
- **Фото** — загрузка (drag & drop / file picker), DnD-сортировка, галерея, lightbox
- **Поиск** — debounced поиск по номиналу, году, стране, заметкам
- **Фильтрация** — по году, номиналу, состоянию, составу, аукциону/продано
- **Сортировка** — по номиналу, году, цене, дате добавления
- **Продано / Аукцион** — флаги sold и onAuction, цена продажи, аукционная цена
- **Состав** — металл монеты (gold, silver, copper, etc.)
- **Валюта** — выбор валюты на монету, валюта по умолчанию в настройках
- **Экспорт Excel** — выгрузка коллекции в .xlsx с фото
- **Экспорт PDF** — выгрузка коллекции в .pdf с фото, кастомизация
- **Импорт** — загрузка из XLSX/CSV (с парсингом и валидацией)
- **Бэкап** — создание ZIP-архива (DB + фото), восстановление
- **AI/LLM** — запрос информации о монетах через LLM (цены, тиражи, нумизматическая справка) на основе текстовых метаданных; экспорт/импорт данных для внешних AI-чатов (ChatGPT/Claude)
- **i18n** — русский / английский интерфейс
- **Настройки** — валюта по умолчанию, язык, бэкап/импорт, настройки AI
- **Infinite scroll** — подгрузка монет при скролле
- **Восстановление скролла** — сохранение позиции при навигации назад
- **Автодополнение** (Autocomplete) — для существующих значений (номинал, год, etc.)

## Управление состоянием (Zustand)

Сторы колоцированы с фичами (нет общей директории `store/`):

| Стор | Файл | Назначение |
|------|------|------------|
| useCollectionManager | `features/collections/useCollections.ts` | CRUD коллекций, выбор |
| useCoins | `features/coins/useCoins.ts` | Список монет, пагинация, состояние |
| useScrollRestoration | `features/coins/useScrollRestoration.ts` | Сохранение позиции скролла |
| usePhotos | `features/photos/usePhotos.ts` | CRUD фото |
| useAiStore | `features/ai/useAiStore.ts` | Состояние AI-запросов (цены, тиражи, справка) |
| useExportStore | `features/export/useExport.ts` | Состояние Excel-экспорта |
| useExportPdfStore | `features/export-pdf/useExportPdf.ts` | Состояние PDF-экспорта |

## Тестирование

| Слой | Что тестируем | Инструмент | Порог coverage |
|------|---------------|------------|----------------|
| Database | Repositories (CRUD, pagination) | Vitest | — |
| Utils | Formatting, currency, export helpers | Vitest | — |
| Features | Zustand stores, API wrappers | Vitest | — |
| Components | Rendering, interaction, user events | Vitest + RTL | — |
| Integration | Backup flow, end-to-end scenarios | Vitest + electron-mocks | — |

**Coverage targets** (vitest.config.ts): lines 70%, branches 60%, functions 70%, statements 70%.

Тесты запускаются через `npm test` (unit + features), `npm run test:integration` (интеграционные).

## Developer commands

```bash
npm run dev              # Dev server (electron-vite)
npm run build            # Production build → out/
npm run preview          # Preview prod build
npm run lint             # ESLint --fix
npm run format           # Prettier
npm run typecheck        # tsc --noEmit (node + web)
npm test                 # Vitest run
npm run test:watch       # Vitest watch
npm run test:integration # Integration tests
npm run test:coverage    # Vitest + coverage report
npm run dist:mac         # Build + package macOS (dmg + zip)
npm run dist:win         # Build + package Windows (nsis + portable)
npm run dist:all         # Build + package both platforms
```

## Build & distribution

- **electron-builder** конфигурация в `electron-builder.yml`
- Output: `dist/`
- macOS: hardened runtime, dmg + zip
- Windows: nsis + portable
- GitHub Actions: `.github/workflows/release.yml` — сборка и релиз по тегу
- CI: `.github/workflows/test.yml` — lint, typecheck, test на push/PR

## Этапы (исторические, все завершены)

1. ~~Инфраструктура — Vite + Electron + React + TS, Tailwind, ESLint, Vitest, electron-builder~~
2. ~~База данных — SQLite, миграции, репозитории, IPC~~
3. ~~UI Kit — базовые компоненты + лейаут~~
4. ~~Страны → Коллекции — CRUD~~
5. ~~Монеты — CRUD + infinite scroll + группировка~~
6. ~~Фото — загрузка, DnD-сортировка, галерея, lightbox~~
7. ~~Экспорт — Excel + PDF~~
8. ~~AI/LLM — запрос цен/тиражей/справки через LLM, экспорт/импорт~~
9. ~~Импорт — spreadsheet, backup restore~~
10. ~~i18n — русский / английский~~
11. ~~Продано / Аукцион — флаги и цены~~
