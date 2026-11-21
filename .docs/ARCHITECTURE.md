# Архитектура Coin Collection (v1.6.1)

Десктоп-приложение для коллекционеров монет: **Electron 33 + React 18 + TypeScript + SQLite**.
Сборка — `electron-vite`; нативные зависимости — `better-sqlite3`, `sharp` (пересобираются под Electron через `electron-rebuild`).

## 1. Процессная модель (Electron)

```mermaid
flowchart TB
    subgraph Main["Main process (Node, sandbox:false)"]
        DB[(SQLite · better-sqlite3)]
        REPO[Repositories<br/>collections · coins · photos · coin_notes · preferences]
        IPC[IPC handlers ×10<br/>collection:* · coin:* · note:* · photo:* · pref:*<br/>import:* · llm:* · backup:* · export:* · export-pdf:*]
        EXP[Экспорт: Excel exceljs · PDF pdfkit · Backup adm-zip]
        IMP[Импорт: xlsx-парсер · бэкап-распаковка]
        LLM[LLM: LangChain chains + web_search]
        DB --> REPO
        IPC --> REPO
        IPC --> EXP
        IPC --> IMP
        IPC --> LLM
    end
    subgraph Preload["Preload"]
        BRIDGE[contextBridge → window.api<br/>ipcRenderer.invoke]
    end
    subgraph Renderer["Renderer (React 18 + TS)"]
        ROUTER[App.tsx · HashRouter]
        FEAT[features: collections · coins · photos · notes · ai · import · export · backup]
        STORE[zustand 5 — store на фичу]
        UI[Tailwind · i18next en/ru · dnd-kit]
        ROUTER --> FEAT --> STORE
        FEAT --> UI
    end
    Renderer -->|"invoke"| BRIDGE --> IPC
    IPC -->|"данные"| BRIDGE --> Renderer
    LLM -->|"HTTP OpenAI-совместимый"| API[OpenAI / OpenRouter / LM Studio / Ollama]
```

- **main** — владеет БД, IPC, логикой экспорта/импорта и LLM-цепочками;
- **preload** — единственный мост: `window.api` (коллекции, монеты, заметки, фото, настройки, импорт, экспорт, бэкап, LLM);
- **renderer** — React-UI, общается с main **только** через `window.api` (в тестах мокается).

## 2. Модель данных (SQLite, миграции V1–V8)

```mermaid
erDiagram
    collections ||--o{ coins : "contains"
    coins ||--o{ photos : "has"
    coins ||--o{ coin_notes : "notes"
    collections {
        text id PK
        text name
        int created_at
        int updated_at
    }
    coins {
        text id PK
        text collection_id FK
        text denomination
        int year
        text condition
        real price
        real shipping_cost
        text currency
        text country
        int sold
        text composition
        int on_auction
        real auction_price
        real sale_price
        text notes
        int created_at
        int updated_at
    }
    photos {
        text id PK
        text coin_id FK
    }
    coin_notes {
        text id PK
        text coin_id FK
    }
    preferences {
        text key PK
        text value
    }
```

Важные нюансы эволюции схемы (из `src/main/database/migrations.ts`):
- **V1**: таблицы `countries`, `coins(country_id)`, `photos(coin_id)`, `preferences`, `coin_notes`, `_migrations`;
- **V4**: `countries` → переименована в **`collections`**, `country_id` → **`collection_id`** (т.е. коллекции изначально были «странами»; индекс `idx_coins_collection(collection_id, denomination, year, id)` навешивается здесь);
- **V6+**: расширение монет — `sold`, `composition`, `on_auction`, `auction_price`, `sale_price`.

## 3. LLM-подсистема (`src/main/llm/`)

- **Абстракция**: `@langchain/openai` — ChatOpenAI-совместимые провайдеры: OpenAI, OpenRouter (builtin `web_search`), LM Studio, Ollama (для локальных моделей увеличенный таймаут 180 с, `maxRetries 0`);
- **Конфиг**: сохраняется в `preferences` (`llm.provider/model/baseUrl/apiKey`, `llm.webSearch`, search-настройки), стартовая загрузка — `dotenv`;
- **Возможности**: заметки по монете (`llm/notes.ts`), агентная цепочка (`llm/chains.ts`), веб-поиск с провайдерами (`llm/search.ts`), bulk-сессии («resume»), валидация выходных схем через **zod** (`llm/schemas.ts`).

## 4. Импорт / экспорт / бэкап

| Канал | Библиотека | Что делает |
|---|---|---|
| Экспорт Excel | `exceljs` | выгрузка коллекции в .xlsx (с локализацией `l10n.ts`) |
| Экспорт PDF | `pdfkit` + встроенные шрифты DejaVu | отчёт по коллекции/монете |
| Бэкап | `adm-zip` | zip-архив с данными (экспорт/импорт `backup.ts`) |
| Импорт таблиц | `xlsx` + свой парсер | разбор xlsx → монеты, маппинг коллекций, выкачка фото |
| Фото | `sharp` | обработка/оптимизация, файлы копируются в `userData/photos/` |

## 5. Тестирование

- **vitest**: unit-тесты (`tests/features`, `tests/integration`, `tests/manual`) + coverage (отчёт в `coverage/` — покрыты main: database/export/import/ipc/llm и renderer: components/features);
- renderer-тесты мокают `window.api`.

## 6. Инфраструктура / прочее

- `.opencode/` — проект разрабатывался через opencode (скилл `github-release`);
- `.codegraph/` — SQLite-граф кода (для навигации);
- `.docs/` — plan.md, feature-notes, llm-integration, web-search;
- сборка дистрибутивов: `electron-builder` (mac/win), `out/` — результат билда.