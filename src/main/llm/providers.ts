import { ChatOpenAI } from '@langchain/openai'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import type { LlmConfig } from '@shared/types'
import { loadLlmConfig } from './config'

export function createLlmModel(config?: Partial<LlmConfig>): BaseChatModel {
  const cfg = { ...loadLlmConfig(), ...config }

  switch (cfg.provider) {
    case 'openrouter':
      return new ChatOpenAI({
        modelName: cfg.model,
        temperature: 0.3,
        apiKey: cfg.apiKey,
        configuration: {
          baseURL: cfg.baseUrl
        }
      })

    case 'lmstudio': {
      let baseUrl = cfg.baseUrl || 'http://localhost:1234/v1'
      if (!baseUrl.endsWith('/v1')) {
        baseUrl = baseUrl.replace(/\/$/, '') + '/v1'
      }
      return new ChatOpenAI({
        modelName: cfg.model,
        temperature: 0.3,
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
        modelName: ollamaModel,
        temperature: 0.3,
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
