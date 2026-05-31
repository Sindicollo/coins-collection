# Coin Collection Desktop App — План

## Технологический стек

| Компонент | Технология | Версия |
|-----------|------------|--------|
| Desktop | Electron | 28+ |
| Bundler | Vite (electron-vite) | 2.x |
| Frontend | React | 18.x |
| Language | TypeScript | 5.x (strict) |
| Styling | Tailwind CSS | 3.x |
| State | Zustand | 4.x |
| Database | better-sqlite3 | 9.x |
| Testing | Vitest + RTL | latest |
| Linting | ESLint + Prettier | latest |
| Builder | electron-builder | 24.x |

## Архитектура данных

### Схема SQLite

```sql
CREATE TABLE countries (
  id TEXT PRIMARY KEY,           -- UUID
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE coins (
  id TEXT PRIMARY KEY,
  country_id TEXT NOT NULL REFERENCES countries(id),
  denomination TEXT NOT NULL,
  year INTEGER,
  condition TEXT,                 -- UNC, XF, VF, F, VG, G, F-2, F-1
  purchase_date INTEGER,
  purchase_place TEXT,            -- ebay, meshok, auction...
  price REAL,
  shipping_cost REAL,
  notes TEXT,
  extra_data TEXT,                -- JSON for custom fields
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE photos (
  id TEXT PRIMARY KEY,
  coin_id TEXT NOT NULL REFERENCES coins(id),
  filename TEXT NOT NULL,
  original_name TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_coins_country ON coins(country_id, denomination, year, id);
```

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
  countryId: string;
  cursor?: string;   // base64(denomination + year + id)
  limit: number;     // 20–50
}

interface PaginatedCoins {
  coins: Coin[];
  nextCursor: string | null;
  hasMore: boolean;
}
```

## Структура проекта

```
coin-collection/
├── src/
│   ├── main/                    # Electron main process
│   │   ├── index.ts
│   │   ├── ipc/                 # IPC handlers
│   │   │   ├── countries.ts
│   │   │   ├── coins.ts
│   │   │   └── photos.ts
│   │   └── database/
│   │       ├── index.ts
│   │       ├── migrations.ts
│   │       └── repositories/
│   │           ├── countries.ts
│   │           ├── coins.ts
│   │           └── photos.ts
│   ├── preload/                 # Preload scripts
│   │   ├── index.ts
│   │   └── index.d.ts
│   ├── renderer/                # React app
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── ui/              # Button, Input, Modal, Card...
│   │   │   ├── layout/          # Sidebar, Header
│   │   │   └── common/          # ImageGallery, CoinCard...
│   │   ├── features/
│   │   │   ├── countries/
│   │   │   ├── coins/
│   │   │   └── photos/
│   │   ├── store/
│   │   │   ├── useCollectionStore.ts
│   │   │   └── useUIStore.ts
│   │   ├── hooks/
│   │   ├── lib/
│   │   │   └── ipc.ts
│   │   └── utils/
│   └── shared/                  # Shared between processes
│       ├── types/
│       └── constants/
├── resources/                   # Static assets
│   └── icons/
├── tests/
│   ├── unit/                    # Repositories, utils
│   └── components/              # Component tests
├── package.json
├── electron-builder.yml
├── electron.vite.config.ts
├── vitest.config.ts
├── .eslintrc.cjs
├── tsconfig.json
├── tsconfig.node.json
├── tsconfig.web.json
└── tailwind.config.js
```

## Фичи MVP

### P0 — Критичные
- Управление странами (CRUD в сайдбаре)
- Управление монетами (CRUD внутри страны)
- Загрузка фото (drag & drop, множественный выбор)
- Просмотр коллекции (infinite scroll сетка)
- Группировка (страна → номинал → год)

### P1 — Важные
- Фильтрация по году, номиналу, состоянию
- Сортировка
- Галерея фото (листание, zoom)
- Поиск (debounced)

### P2 — Будущее
- Пользовательские поля
- Подборки/коллекции
- Экспорт JSON/CSV

## Тестирование (цель: 70–80%)

| Слой | Что тестируем | Инструмент |
|------|---------------|------------|
| Database | Repositories (CRUD, pagination) | Vitest |
| Utils | Formatting, validation | Vitest |
| Store | Zustand actions, selectors | Vitest |
| Components | Rendering, interaction | RTL + Vitest |

## Этапы

1. **Инфраструктура** — Vite + Electron + React + TS, Tailwind, ESLint, Vitest, electron-builder
2. **База данных** — SQLite, миграции, репозитории, IPC
3. **UI Kit** — базовые компоненты + лейаут
4. **Страны** — CRUD
5. **Монеты** — CRUD + infinite scroll + группировка
6. **Фото** — загрузка, галерея
7. **Zustand stores** — интеграция
8. **Полировка** — линт, coverage, билд
