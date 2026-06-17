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

  switch (cfg.provider) {
    case 'openrouter': {
      const enableWebSearch = cfg.enableWebSearch

      return new ChatOpenAI({
        ...common,
        modelName: cfg.model,
        apiKey: cfg.apiKey,
        configuration: {
          baseURL: cfg.baseUrl,
          // Intercept fetch to inject web search via OpenRouter tools API
          ...(enableWebSearch && {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            fetch: async (url: any, init?: any) => {
              if (init?.body && typeof init.body === 'string') {
                try {
                  const body = JSON.parse(init.body)
                  // OpenRouter new tools API for web search (replaces deprecated plugins)
                  body.tools = [
                    {
                      type: 'openrouter:web_search',
                      parameters: { max_results: 5, search_context_size: 'medium' }
                    }
                  ]
                  // model selects tool mode — auto: model decides, none: off
                  delete body.tool_choice
                  init = { ...init, body: JSON.stringify(body) }
                } catch { /* not JSON */ }
              }

              return fetch(url, init)
            }
          })
        }
      })
    }

    case 'lmstudio': {
      let baseUrl = cfg.baseUrl || 'http://localhost:1234/v1'
      if (!baseUrl.endsWith('/v1')) {
        baseUrl = baseUrl.replace(/\/$/, '') + '/v1'
      }
      return new ChatOpenAI({
        ...common,
        modelName: cfg.model,
        apiKey: cfg.apiKey || 'lm-studio',
        configuration: {
          baseURL: baseUrl
        }
      })
    }

    case 'ollama': {
      let baseUrl = cfg.baseUrl || 'http://localhost:11434/v1'
      if (!baseUrl.endsWith('/v1')) {
        baseUrl = baseUrl.replace(/\/$/, '') + '/v1'
      }
      const ollamaModel = cfg.model.includes('/') ? cfg.model.split('/').pop()! : cfg.model
      return new ChatOpenAI({
        ...common,
        modelName: ollamaModel,
        apiKey: cfg.apiKey || 'ollama',
        configuration: {
          baseURL: baseUrl
        }
      })
    }

    default:
      throw new Error(`Unknown LLM provider: ${cfg.provider}`)
  }
}
