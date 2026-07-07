# Web Search для локальных LLM (LM Studio / Ollama)

## Проблема

Web search работает только через OpenRouter (server-side `openrouter:web_search` tool injection через `fetch` перехват). Для локальных LLM (LM Studio, Ollama) веб-поиск недоступен, потому что:
- Они не имеют встроенного search backend'а как OpenRouter
- Текущий код не делает реальных HTTP-запросов к поисковым API — он только подменяет тело запроса для OpenRouter'а

## Решение

Унифицировать web search через **LangChain Agent + Tool**: модель сама вызывает tool-call, приложение исполняет поиск (Tavily/Brave/DDG/SearXNG) через HTTP, результаты скармливаются обратно в контекст. Работает с любым OpenAI-совместимым провайдером.

## Архитектурные решения

| Вопрос | Решение |
|--------|---------|
| Поисковый бэкенд | Несколько на выбор: Tavily, Brave Search, DuckDuckGo, SearXNG, OpenRouter built-in |
| OpenRouter путь | Унифицировать через агента (выпилить fetch-хак) |
| Bulk с поиском | Под капотом превращается в N single-coin запросов (по 1 монете) |
| Resume | Через preferences table (R2), без миграции БД |
| AI note идентификация | Title prefix `AI: prices` / `AI: mintage` / `AI: info` |
| Сохранение partial | Auto-save в БД по мере обработки (S2) |
| Формат tool output | Сжатый (title + snippet, до 500 chars) |
| Документация | В README.md (английский, общий файл) |

## Этапы реализации

### Spike (предварительная проверка)

- Установить `@langchain/community`
- Создать `tests/manual/web-search-spike.test.ts` с mocked-тестом LM Studio + Tavily tool calling
- Определить, какой agent API доступен в `@langchain/openai@1.4.7`: `createOpenAIToolsAgent` (core) или `createReactAgent` (langgraph)
- Прогнать mocked-тест → подтвердить совместимость LC 1.1.49 с agentic flow

### Stage 1: Backend

**Файлы:**
- `package.json` — добавить `@langchain/community` (+ `@langchain/langgraph` если нужен)
- `src/shared/types/llm.ts` — `SearchProvider`, `SearchConfig`, расширить `LlmConfig`, `AiBulkQuery`, `LlmTestResult`
- `src/main/llm/search.ts` — **новый**, фабрика инструментов + `testSearchProvider()`
- `src/main/llm/providers.ts` — убрать fetch-хак из `case 'openrouter'`
- `src/main/llm/chains.ts` — `querySingleCoinWithSearch()`, `queryBulkCoinsWithSearch()`
- `src/main/llm/config.ts` — `PREF_KEYS.search*`, `loadBulkSession`/`saveBulkSession`/`clearBulkSession`
- `src/main/llm/notes.ts` — **новый**, `createAiNote()`, `hasAiNoteForQuery()`
- `src/main/ipc/llm.ts` — адаптировать QUERY_BULK (auto-save, resume, per-coin progress), TEST_CONNECTION (tool-calling check)

**Тесты:** `search.test.ts`, `chains-search.test.ts`, `config-session.test.ts`

### Stage 2: Frontend

**Файлы:**
- `SettingsModal.tsx` — секция "Web Search" с provider dropdown, api key, max results, test button
- `LlmTools.tsx` — кнопка Resume, per-coin progress в bulk-with-search
- `en.json` / `ru.json` — i18n keys
- `tests/setup.ts` — расширить моки

### Stage 3: UX-polish

- Warning при >50 монет с web search (оценка времени)
- Crash-recovery: удалять stale sessions старше 24h
- Duplicate-note защита: update вместо create

### Stage 4: Documentation

- `README.md` — новый раздел "Web Search Setup"
- Help tooltips в SettingsModal со ссылками на получение API-ключей

## Требования к локальным моделям

Модель должна поддерживать **OpenAI tool-calling** формат. Рекомендуемые:
- Qwen2.5 (7B+, tested)
- Llama 3.1+ (8B+)
- Phi-3.5-mini+
- Mistral v0.3+
- Hermes function calling models

## Поисковые провайдеры

| Provider | Free tier | Ключ | Примечание |
|----------|-----------|------|------------|
| Tavily | 1000/mo | tavily.com | Оптимизирован для LLM, рекомендуемый |
| Brave Search | 2000/mo | api.search.brave.com | Хорошее покрытие |
| DuckDuckGo | Unlimited (rate-limited) | нет | Для тестирования, нестабильный |
| SearXNG | Unlimited | self-host | Docker: `searxng/searxng` |
| OpenRouter built-in | n/a | OpenRouter key | Только для OpenRouter, server-side |

## Порядок коммитов

1. `feat(llm): web search backend with Tavily/Brave/DDG/SearXNG support`
2. `feat(ui): web search settings and bulk resume UX`
3. `feat(llm): warnings, time estimates, crash-recovery for bulk-with-search`
4. `docs: web search setup instructions`
