import { ChatOpenAI } from '@langchain/openai'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import type { LlmConfig } from '@shared/types'
import { loadLlmConfig } from './config'

/**
 * Create a ChatOpenAI model for the configured LLM provider.
 *
 * For `openrouter_builtin` search, configures the fetch-hack that injects
 * OpenRouter's server-side `web_search` tool. For all other search providers,
 * the model is created without any tool binding — tools are bound separately
 * by the agentic loop in chains.ts.
 */
export function createLlmModel(config?: Partial<LlmConfig>): BaseChatModel {
  const cfg = { ...loadLlmConfig(), ...config }

  if (!cfg.model) {
    throw new Error('Model name is empty. Set a model in AI Settings (e.g., openai/gpt-4.1).')
  }

  const common = {
    temperature: 0.3,
    maxTokens: 16384,
    timeout: 120000
  }

  // Ensure OpenAI-compatible base URL ends with /v1
  function normalizeUrl(baseUrl: string, fallback: string): string {
    let url = baseUrl || fallback
    if (!url.endsWith('/v1')) {
      url = url.replace(/\/$/, '') + '/v1'
    }
    return url
  }

  switch (cfg.provider) {
    case 'openrouter': {
      const useBuiltinSearch =
        cfg.enableWebSearch && cfg.search?.provider === 'openrouter_builtin'

      const configuration: Record<string, unknown> = {
        baseURL: cfg.baseUrl
      }

      if (useBuiltinSearch) {
        // Inject OpenRouter's native web_search tool via fetch override.
        // This is the only case where we modify the request body — for all
        // other search providers, tool binding is handled in chains.ts.
        configuration.fetch = async (url: unknown, init?: RequestInit) => {
          if (init?.body && typeof init.body === 'string') {
            try {
              const body = JSON.parse(init.body)
              body.tools = [
                {
                  type: 'openrouter:web_search',
                  parameters: { max_results: 5, search_context_size: 'medium' }
                }
              ]
              delete body.tool_choice
              init = { ...init, body: JSON.stringify(body) }
            } catch {
              /* not JSON — pass through */
            }
          }
          return fetch(url as RequestInfo | URL, init)
        }
      }

      return new ChatOpenAI({
        ...common,
        modelName: cfg.model,
        apiKey: cfg.apiKey,
        configuration
      })
    }

    case 'lmstudio':
      return new ChatOpenAI({
        ...common,
        modelName: cfg.model,
        apiKey: cfg.apiKey || 'lm-studio',
        configuration: {
          baseURL: normalizeUrl(cfg.baseUrl, 'http://localhost:1234/v1')
        }
      })

    case 'ollama': {
      const ollamaModel = cfg.model.includes('/') ? cfg.model.split('/').pop()! : cfg.model
      return new ChatOpenAI({
        ...common,
        modelName: ollamaModel,
        apiKey: cfg.apiKey || 'ollama',
        configuration: {
          baseURL: normalizeUrl(cfg.baseUrl, 'http://localhost:11434/v1')
        }
      })
    }

    default:
      throw new Error(`Unknown LLM provider: ${cfg.provider}`)
  }
}
