/**
 * Spike: verify LangChain tool-call loop works with ChatOpenAI + DynamicTool.
 *
 * This test mocks both the LM Studio endpoint and the search API to confirm
 * that our tool-calling plumbing is correct with the current LC 1.1.49 versions.
 *
 * Architecture discovered:
 *   - bindTools() exists on ChatOpenAI (base class) ✓
 *   - DynamicTool / ToolMessage / AIMessage / HumanMessage / SystemMessage all available ✓
 *   - No AgentExecutor/langgraph needed — manual loop is simpler for our use case
 *
 * Run:
 *   npx vitest run tests/manual/web-search-spike.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ChatOpenAI } from '@langchain/openai'
import { DynamicTool } from '@langchain/core/tools'
import { HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages'
import type { SystemMessage as SystemMessageType } from '@langchain/core/messages'
import { SystemMessage } from '@langchain/core/messages'

// ── Mock search tool ────────────────────────────────────────────────

const searchTool = new DynamicTool({
  name: 'web_search',
  description:
    'Search the internet for current information. Input: a search query string. Output: search results.',
  func: async (_query: string) => {
    return JSON.stringify({
      results: [
        {
          title: '1889 Silver Crown Victoria',
          snippet: 'KM# 765. Silver 925, 28.28g. Recent eBay sold: $150-300. Melt ~$25.'
        }
      ]
    })
  }
})

// ── Helper: build messages array for tool-calling ──────────────────

function buildMessages(
  systemPrompt: string,
  userPrompt: string
): (HumanMessage | SystemMessageType)[] {
  return [new SystemMessage(systemPrompt), new HumanMessage(userPrompt)]
}

// ── Manual tool-calling loop ───────────────────────────────────────

async function invokeWithTools(
  model: ChatOpenAI,
  messages: (HumanMessage | SystemMessageType)[],
  tools: DynamicTool[],
  maxIterations = 6
): Promise<string> {
  const bound = model.bindTools(tools)

  for (let i = 0; i < maxIterations; i++) {
    const response = await bound.invoke(messages)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolCalls = (response as any).tool_calls || response.additional_kwargs?.tool_calls

    if (!toolCalls || toolCalls.length === 0) {
      // No more tool calls — this is the final response
      const content = response.content
      if (typeof content === 'string') return content
      if (Array.isArray(content)) {
        return content
          .map((block) =>
            typeof block === 'string' ? block : 'text' in block ? (block as { text: string }).text : ''
          )
          .join('')
      }
      return String(content)
    }

    // Execute tool calls and feed results back
    const toolMessages: ToolMessage[] = []
    for (const tc of toolCalls) {
      // LC normalizes OpenAI tool-call format:
      // raw OpenAI:   { id, type, function: { name, arguments } }
      // LC parsed:    { id, type, name, args }
      const fn = tc.function || tc
      const name = fn.name || tc.name
      const rawArgs = fn.args || fn.arguments
      const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs || {}
      const tool = tools.find((t) => t.name === name)
      if (tool) {
        const result = await tool.invoke(args.query || args.input || JSON.stringify(args))
        toolMessages.push(
          new ToolMessage({ content: String(result), tool_call_id: tc.id || name || 'unknown' })
        )
      }
    }

    messages = [...messages, response, ...toolMessages]
  }

  throw new Error(`Tool-call loop exceeded max iterations (${maxIterations})`)
}

// ── Mock fetch for LM Studio + search ───────────────────────────────

function mockLmStudioToolCallResponse(query: string) {
  return {
    id: 'chatcmpl-mock-001',
    object: 'chat.completion',
    created: Date.now(),
    model: 'qwen2.5-7b-instruct',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call_mock_001',
              type: 'function',
              function: {
                name: 'web_search',
                arguments: JSON.stringify({ query })
              }
            }
          ]
        },
        finish_reason: 'tool_calls'
      }
    ],
    usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 }
  }
}

function mockLmStudioFinalResponse(price: string) {
  return {
    id: 'chatcmpl-mock-002',
    object: 'chat.completion',
    created: Date.now(),
    model: 'qwen2.5-7b-instruct',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: JSON.stringify({
            id: 'coin-1',
            price: price || '150-300 $',
            info: 'KM# 765. Silver 925, 28.28g.'
          }),
          tool_calls: null
        },
        finish_reason: 'stop'
      }
    ],
    usage: { prompt_tokens: 100, completion_tokens: 40, total_tokens: 140 }
  }
}

// ── Tests ──────────────────────────────────────────────────────────

describe('Web search tool-calling spike', () => {
  let fetchCallCount = 0

  beforeEach(() => {
    fetchCallCount = 0
    vi.restoreAllMocks()

    globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      fetchCallCount++
      const urlStr = String(url)
      const body = init?.body ? JSON.parse(init.body as string) : {}

      // Mock LM Studio chat completions
      if (urlStr.includes('/v1/chat/completions')) {
        const hasTools = body.tools && body.tools.length > 0

        // Check if this is the first call (with tool definitions) or second (with tool results)
        const messages: Array<{ role: string; content?: string; tool_calls?: unknown[] }> =
          body.messages || []
        const hasToolMessages = messages.some((m) => m.role === 'tool')

        if (hasTools && !hasToolMessages) {
          // First call: model should emit a tool call
          const userMsg = messages.find((m) => m.role === 'user')
          const userContent =
            typeof userMsg?.content === 'string'
              ? userMsg.content
              : Array.isArray(userMsg?.content)
                ? userMsg.content
                    .map((b: unknown) => (typeof b === 'string' ? b : (b as { text: string }).text))
                    .join('')
                : ''

          return new Response(
            JSON.stringify(mockLmStudioToolCallResponse(userContent.slice(0, 100))),
            {
              status: 200,
              headers: { 'content-type': 'application/json' }
            }
          )
        }

        if (hasToolMessages) {
          // Second call: model should return final JSON response
          return new Response(JSON.stringify(mockLmStudioFinalResponse('150-300 $')), {
            status: 200,
            headers: { 'content-type': 'application/json' }
          })
        }

        // Fallback: return final response
        return new Response(JSON.stringify(mockLmStudioFinalResponse('100-150 $')), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }

      // Any other request (search mock is handled by DynamicTool func, no fetch needed)
      return new Response(JSON.stringify({ error: 'not mocked' }), {
        status: 404,
        headers: { 'content-type': 'application/json' }
      })
    })
  })

  it('completes tool-call loop: model calls tool, receives result, returns final JSON', async () => {
    const model = new ChatOpenAI({
      modelName: 'qwen2.5-7b-instruct',
      apiKey: 'lm-studio',
      temperature: 0,
      configuration: {
        baseURL: 'http://localhost:1234/v1'
      }
    })

    const messages = buildMessages(
      'You are a coin valuation expert. Use web_search tool to find current market prices.',
      'What is the price of a 1889 British silver crown?'
    )

    const result = await invokeWithTools(model, messages, [searchTool])

    console.log('[spike] Final result:', result)

    // Verify the tool-call loop ran: at least 2 chat completions calls
    // (1st with tools → tool_calls, 2nd with tool results → final JSON)
    expect(fetchCallCount).toBeGreaterThanOrEqual(2)

    // Verify the result is valid JSON
    const parsed = JSON.parse(result)
    expect(parsed).toHaveProperty('id')
    expect(parsed).toHaveProperty('price')
    expect(parsed).toHaveProperty('info')
  })

  it('handles case when model does NOT emit tool calls (no tool-calling support)', async () => {
    // Setup mock to NOT return tool_calls — return plain text instead
    globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(init.body as string) : {}
      const messages = body.messages || []
      const hasToolMessages = messages.some((m: { role: string }) => m.role === 'tool')

      if (!hasToolMessages) {
        // Model ignores tool definition, just returns text
        return new Response(
          JSON.stringify({
            id: 'chatcmpl-mock-003',
            object: 'chat.completion',
            created: Date.now(),
            model: 'tiny-model',
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content:
                    'I cannot browse the internet. Based on my training data, a 1889 silver crown is worth approximately 150-300 dollars.',
                  tool_calls: null
                },
                finish_reason: 'stop'
              }
            ]
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }

      return new Response(JSON.stringify({ error: 'unexpected' }), { status: 500 })
    })

    const model = new ChatOpenAI({
      modelName: 'tiny-llm-no-tool-support',
      apiKey: 'lm-studio',
      temperature: 0,
      configuration: {
        baseURL: 'http://localhost:1234/v1'
      }
    })

    const messages = buildMessages(
      'You are a coin valuation expert. Use web_search tool.',
      'What is the price of a 1889 silver crown?'
    )

    const result = await invokeWithTools(model, messages, [searchTool])

    console.log('[spike] No-tool result:', result.slice(0, 80))

    // Model responded without calling tool — we get text directly
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
    // Verify it contains something meaningful (not JSON, since model ignored tool)
    expect(result).toContain('dollar')
  })

  it('handles model that calls tool multiple times', async () => {
    let callIndex = 0

    globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      callIndex++
      const body = init?.body ? JSON.parse(init.body as string) : {}

      if (String(url).includes('chat/completions')) {
        const messages = body.messages || []
        const hasToolMessages = messages.some((m: { role: string }) => m.role === 'tool')

        if (callIndex === 1 && !hasToolMessages) {
          // First call: call tool
          return new Response(
            JSON.stringify({
              id: 'mock-1',
              object: 'chat.completion',
              created: Date.now(),
              model: 'qwen2.5',
              choices: [
                {
                  index: 0,
                  message: {
                    role: 'assistant',
                    content: null,
                    tool_calls: [
                      {
                        id: 'call_1',
                        type: 'function',
                        function: {
                          name: 'web_search',
                          arguments: JSON.stringify({ query: 'first search' })
                        }
                      }
                    ]
                  },
                  finish_reason: 'tool_calls'
                }
              ]
            }),
            { status: 200, headers: { 'content-type': 'application/json' } }
          )
        }

        if (callIndex === 2 && hasToolMessages) {
          // Second call: call tool AGAIN (multi-hop)
          return new Response(
            JSON.stringify({
              id: 'mock-2',
              object: 'chat.completion',
              created: Date.now(),
              model: 'qwen2.5',
              choices: [
                {
                  index: 0,
                  message: {
                    role: 'assistant',
                    content: null,
                    tool_calls: [
                      {
                        id: 'call_2',
                        type: 'function',
                        function: {
                          name: 'web_search',
                          arguments: JSON.stringify({ query: 'refinement search' })
                        }
                      }
                    ]
                  },
                  finish_reason: 'tool_calls'
                }
              ]
            }),
            { status: 200, headers: { 'content-type': 'application/json' } }
          )
        }

        // Third call: final response
        return new Response(
          JSON.stringify({
            id: 'mock-3',
            object: 'chat.completion',
            created: Date.now(),
            model: 'qwen2.5',
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: '{"id":"coin-1","price":"150-300 $","info":"KM# 765"}',
                  tool_calls: null
                },
                finish_reason: 'stop'
              }
            ]
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }

      return new Response(JSON.stringify({ error: 'not mocked' }), { status: 404 })
    })

    const model = new ChatOpenAI({
      modelName: 'qwen2.5-7b-instruct',
      apiKey: 'lm-studio',
      temperature: 0,
      configuration: {
        baseURL: 'http://localhost:1234/v1'
      }
    })

    const messages = buildMessages(
      'Use web_search to find info. You may need multiple searches.',
      'Research coin price'
    )

    const result = await invokeWithTools(model, messages, [searchTool])

    console.log('[spike] Multi-hop result:', result)
    expect(callIndex).toBe(3) // 2 tool calls + 1 final
    const parsed = JSON.parse(result)
    expect(parsed).toHaveProperty('price')
  })
})
