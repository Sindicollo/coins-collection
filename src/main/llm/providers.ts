import { ChatOpenAI } from '@langchain/openai'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import type { LlmConfig } from '@shared/types'
import { loadLlmConfig } from './config'

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
      const enableWebSearch = cfg.enableWebSearch

      const configuration: Record<string, unknown> = {
        baseURL: cfg.baseUrl
      }

      if (enableWebSearch) {
        configuration.fetch = async (url: any, init?: any) => {
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
            } catch { /* not JSON */ }
          }
          return fetch(url, init)
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
