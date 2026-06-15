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
| Ollama | Локальный | `@langchain/community` |

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
  provider: 'openrouter' | 'lmstudio' | 'ollama'
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
