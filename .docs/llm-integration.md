# LLM Integration Plan — Coin Collection

## Цель

Автоматизировать взаимодействие с LLM для получения информации о монетах коллекции.
Сейчас процесс ручной: экспорт JSON → чат с LLM → импорт JSON обратно.
Хотим: нажал кнопку «Узнать цены» → LLM ответил → результаты на экране → записал в notes.

## Провайдеры

| Провайдер | Тип | Пакет |
|-----------|-----|-------|
| OpenRouter | Облачный (OpenAI-совместимый API) | `@langchain/openai` |
| LM Studio | Локальный | `@langchain/openai` (localhost) |
| Ollama | Локальный | `@langchain/openai` (localhost, `/v1`) |
| Unsloth Studio | Локальный (`127.0.0.1:8888/v1`) | `@langchain/openai` |

### Unsloth Studio

Studio поднимает OpenAI-совместимый сервер (`unsloth studio --api-only`), который требует
bearer-ключ. Ключ создаётся автоматически: `src/main/llm/unsloth.ts` читает desktop-креденшл
Studio (`~/.unsloth/studio/auth/.desktop_secret`), меняет его на owner-токен через
`POST /api/auth/desktop-login` и минтит inference-ключ через `POST /api/auth/api-keys`
(`{ name: "Coin Collection", access: "inference" }`). IPC — `llm:unsloth-connect`.

Ограничения и поведение:

- **Только loopback.** Desktop-секрет даёт права владельца, поэтому он отправляется лишь на
  `127.0.0.1` / `localhost` / `::1`; для любого другого URL возвращается `invalid_base_url`, и
  ключ нужно создать вручную в Studio.
- **Порт определяется из установки.** Shell пишет фактический порт в
  `~/.unsloth/studio/run/desktop_backend.json` (8888 может быть занят, CLI принимает `-p`).
- **Без дубликатов.** Уже сохранённый (или введённый в форме) ключ сначала проверяется через
  `GET /v1/models`; повторное нажатие «Connect» обновляет список моделей, а не создаёт новый ключ.
  Параллельные вызовы объединяются в один запрос.
- **Коды ошибок**: `not_installed`, `not_running`, `invalid_base_url`, `multi_account`,
  `auth_failed`, `key_create_failed`, `unknown`.

Конфигурация — через `.env` файл:
```
LLM_PROVIDER=openrouter
LLM_MODEL=openai/gpt-4.1
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_API_KEY=sk-or-v1-...
```

## Архитектура

```
renderer (React)                    main process (Electron)
┌─────────────────────────┐         ┌──────────────────────────────┐
│ /ai/:collectionId        │  IPC    │ src/main/llm/                 │
│  AiPage → AiCoinCard[]   │◄───────►│  ├── config.ts    (env vars) │
│  AiSettingsModal          │         │  ├── providers.ts (factory)  │
│  useAiStore (Zustand)     │         │  ├── schemas.ts   (Zod)      │
└─────────────────────────┘         │  ├── chains.ts    (LangChain) │
                                     │  └── ipc/llm.ts   (handlers)  │
                                     └──────────────────────────────┘
```

## Модель данных

```typescript
// Тип запроса
type QueryType = 'prices' | 'mintage' | 'info'

// Ответ от LLM (structured JSON)
interface AiCoinInfo {
  id: string
  info?: string        // общая информация
  price?: string       // оценочная цена
  mintage?: string     // тираж
  rarity?: string      // редкость
  varieties?: string[] // разновидности
}

// Конфигурация LLM
interface LlmConfig {
  provider: 'openrouter' | 'lmstudio' | 'ollama' | 'unsloth'
  model: string
  baseUrl: string
  apiKey: string
}
```

## IPC каналы (новые)

| Канал | Направление | Аргументы | Возврат |
|-------|------------|-----------|---------|
| `llm:query-bulk` | renderer → main | `{ collectionId, queryType, config? }` | `AiCoinInfo[]` |
| `llm:query-single` | renderer → main | `{ coinId, queryType, config? }` | `AiCoinInfo` |
| `llm:get-config` | renderer → main | — | `LlmConfig` |
| `llm:test-connection` | renderer → main | `config?` | `{ ok: boolean, error?: string }` |
| `llm:unsloth-connect` | renderer → main | `baseUrl?, existingApiKey?` | `{ ok, apiKey, baseUrl, models }` / `{ ok: false, code, detail? }` |

## UI-поток

1. Пользователь в коллекции → кнопка [AI] в шапке CoinView
2. Переход на `/ai/:collectionId`
3. AiHeader: кнопки [Узнать цены] [Узнать тираж] [Общая инфо] [⚙]
4. Список монет: каждая карточка с textarea (текущие notes + AI-инфа)
5. Под textarea: [Записать в Notes] [Очистить] [💰eBay] [ℹ инфо]
6. Запись в notes — дописывает AI-инфу через `\n\n---\n`

## Два режима

- **Автоматический** (API-ключ есть): прямой запрос к LLM → парсинг → UI
- **Ручной** (без ключа): формирует prompt → копирует в буфер → пользователь вставляет ответ в textarea → парсинг

## Файлы (что создаем/меняем)

### Новые файлы
| Файл | Назначение |
|------|-----------|
| `src/main/llm/config.ts` | Загрузка конфигурации из env |
| `src/main/llm/providers.ts` | Фабрика LangChain моделей |
| `src/main/llm/schemas.ts` | Zod схемы для structured output |
| `src/main/llm/chains.ts` | LangChain chains (prices/mintage/info/single) |
| `src/shared/types/llm.ts` | AiCoinInfo, LlmConfig, QueryType |
| `src/renderer/features/ai/AiPage.tsx` | Основная страница AI |
| `src/renderer/features/ai/AiCoinCard.tsx` | Карточка монеты с AI-инфой |
| `src/renderer/features/ai/AiSettingsModal.tsx` | Настройки LLM (провайдер, модель, ключ) |
| `src/renderer/features/ai/useAiStore.ts` | Zustand store для AI результатов |
| `src/renderer/features/ai/api.ts` | Вызовы `window.api.llm` |
| `src/renderer/features/ai/index.ts` | Экспорты |
| `src/renderer/components/ui/icons/Ai.tsx` | SVG иконка |

### Изменяемые файлы
| Файл | Изменения |
|------|----------|
| `package.json` | +langchain, @langchain/core, @langchain/openai, @langchain/community, dotenv, zod |
| `src/main/index.ts` | dotenv.config() в начале |
| `src/main/ipc/llm.ts` | Новые handlers |
| `src/shared/types/electron-api.ts` | Расширение api.llm |
| `src/shared/types/index.ts` | Экспорт llm.ts |
| `src/shared/constants/index.ts` | Новые IPC_CHANNELS.LLM |
| `src/renderer/App.tsx` | Роут /ai/:collectionId |
| `src/renderer/features/coins/CoinView.tsx` | Кнопка AI |
| `src/renderer/locales/en.json` | ~20 новых ключей |
| `src/renderer/locales/ru.json` | ~20 новых ключей |

## Порядок реализации

1. **Фундамент**: зависимости, типы, конфигурация
2. **Main process**: провайдеры, chains, IPC handlers
3. **Renderer**: AI-страница, компоненты, store
4. **Навигация**: роут, кнопка AI, иконка
5. **i18n**: ключи en.json + ru.json
