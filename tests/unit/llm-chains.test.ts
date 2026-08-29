/**
 * Unit tests for src/main/llm/chains.ts — textual tool-call recovery
 * and the agentic loop robustness (reasoning models).
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi } from 'vitest'
import { AIMessage, AIMessageChunk, HumanMessage, ToolMessage, SystemMessage } from '@langchain/core/messages'
import type { BaseMessage } from '@langchain/core/messages'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { DynamicTool } from '@langchain/core/tools'
import type { Coin } from '@shared/types'
import { extractTextualToolCall, querySingleCoinWithSearch } from '../../src/main/llm/chains'

const coin: Coin = {
  id: 'coin-1',
  collectionId: 'col-1',
  denomination: '1 Dinero',
  year: 1875,
  condition: 'XF',
  purchaseDate: null,
  purchasePlace: null,
  price: null,
  shippingCost: null,
  currency: null,
  country: 'Peru',
  composition: 'silver',
  extraData: null,
  sold: false,
  onAuction: false,
  auctionPrice: null,
  salePrice: null,
  createdAt: 0,
  updatedAt: 0
}

function makeSearchTool(func: (query: string) => Promise<string>) {
  return new DynamicTool({
    name: 'web_search',
    description: 'Search the internet',
    func
  })
}

function makeModel(invokeImpl: (messages: BaseMessage[]) => Promise<AIMessage>) {
  const bound = { invoke: vi.fn(invokeImpl) }
  // The unbound model needs its own `invoke` for the JSON-recovery pass
  const model = {
    bindTools: vi.fn(() => bound),
    invoke: vi.fn()
  }
  return { model: model as unknown as BaseChatModel, bound }
}

describe('extractTextualToolCall', () => {
  it('parses the Qwen-Agent XML format emitted inside reasoning_content', () => {
    // Verbatim shape from the failing LM Studio log
    const text =
      '<tool_call>\n<function=web_search>\n<parameter=input>\n' +
      'Peru 1875 1 Dinero coin design obverse reverse mint mark YJ Lima\n' +
      '</parameter>\n</function>\n</tool_call>'

    expect(extractTextualToolCall(text)).toEqual({
      name: 'web_search',
      args: { input: 'Peru 1875 1 Dinero coin design obverse reverse mint mark YJ Lima' }
    })
  })

  it('parses the JSON <tool_call> format', () => {
    const text =
      '<tool_call>{"name": "web_search", "arguments": {"input": "Peru KM 190"}}</tool_call>'

    expect(extractTextualToolCall(text)).toEqual({
      name: 'web_search',
      args: { input: 'Peru KM 190' }
    })
  })

  it('returns null for plain text, empty input and unrelated markup', () => {
    expect(extractTextualToolCall('')).toBeNull()
    expect(extractTextualToolCall('{"id": "coin-1", "info": "final answer"}')).toBeNull()
    expect(extractTextualToolCall('<tool_call>not json</tool_call>')).toBeNull()
    expect(extractTextualToolCall('<function=>no name</function>')).toBeNull()
  })
})

describe('querySingleCoinWithSearch', () => {
  it('recovers a tool call that the model "thought" into reasoning_content', async () => {
    const searchFunc = vi.fn(async (q: string) => `SEARCH RESULTS for: ${q}`)
    const tool = makeSearchTool(searchFunc)

    const { model, bound } = makeModel(
      vi
        .fn()
        .mockResolvedValueOnce(
          new AIMessage({
            content: '',
            additional_kwargs: {
              reasoning_content:
                '<tool_call>\n<function=web_search>\n<parameter=input>\nPeru KM# 190 specs\n</parameter>\n</function>\n</tool_call>'
            }
          })
        )
        .mockResolvedValueOnce(
          new AIMessage({ content: '{"id": "coin-1", "info": "Peru 1875 Dinero, KM# 190"}' })
        )
    )

    const result = await querySingleCoinWithSearch(model, tool, coin, 'info', 'ru')

    expect(searchFunc).toHaveBeenCalledTimes(1)
    expect(searchFunc.mock.calls[0][0]).toBe('Peru KM# 190 specs')
    expect(bound.invoke).toHaveBeenCalledTimes(2)
    expect(result.id).toBe('coin-1')
    expect(result.info).toContain('KM# 190')

    // The second invocation must see the synthesized tool call + tool result
    const secondCallMessages = bound.invoke.mock.calls[1][0] as BaseMessage[]
    const toolMsg = secondCallMessages.find((m) => m instanceof ToolMessage)
    expect(toolMsg).toBeDefined()
    expect(String(toolMsg!.content)).toContain('SEARCH RESULTS for: Peru KM# 190 specs')
  })

  it('nudges the model when it returns an empty answer without tool calls', async () => {
    const tool = makeSearchTool(async () => 'unused')

    const { model, bound } = makeModel(
      vi
        .fn()
        .mockResolvedValueOnce(new AIMessage({ content: '' }))
        .mockResolvedValueOnce(
          new AIMessage({ content: '{"id": "coin-1", "info": "recovered after nudge"}' })
        )
    )

    const result = await querySingleCoinWithSearch(model, tool, coin, 'info', 'ru')

    expect(bound.invoke).toHaveBeenCalledTimes(2)
    expect(result.info).toBe('recovered after nudge')

    const secondCallMessages = bound.invoke.mock.calls[1][0] as BaseMessage[]
    const lastMsg = secondCallMessages[secondCallMessages.length - 1]
    expect(lastMsg).toBeInstanceOf(HumanMessage)
    expect(String(lastMsg.content)).toContain('ТОЛЬКО финальный JSON')
  })

  it('keeps the structured tool_calls path working (regression)', async () => {
    const searchFunc = vi.fn(async (q: string) => `RESULTS: ${q}`)
    const tool = makeSearchTool(searchFunc)

    const { model } = makeModel(
      vi
        .fn()
        .mockResolvedValueOnce(
          new AIMessage({
            content: '',
            tool_calls: [
              { id: 'call_1', name: 'web_search', args: { input: 'Peru 1875 dinero' }, type: 'tool_call' }
            ]
          })
        )
        .mockResolvedValueOnce(new AIMessage({ content: '{"id": "coin-1", "info": "done"}' }))
    )

    const result = await querySingleCoinWithSearch(model, tool, coin, 'info', 'en')

    expect(searchFunc).toHaveBeenCalledTimes(1)
    expect(searchFunc.mock.calls[0][0]).toBe('Peru 1875 dinero')
    expect(result.info).toBe('done')
  })

  it('fails with the empty-response error after nudges are exhausted', async () => {
    const tool = makeSearchTool(async () => 'unused')
    const { model, bound } = makeModel(vi.fn().mockResolvedValue(new AIMessage({ content: '' })))

    await expect(querySingleCoinWithSearch(model, tool, coin, 'info', 'en')).rejects.toThrow(
      /empty response/i
    )
    // initial + 2 nudges, then gives up
    expect(bound.invoke).toHaveBeenCalledTimes(3)
    // empty-response already went through nudges — no JSON-recovery re-invoke
    expect(model.invoke).not.toHaveBeenCalled()
  })

  it('recovers a mangled final JSON with one corrective pass', async () => {
    const tool = makeSearchTool(async () => 'unused')
    // First pass reproduces the real-world failure: an unescaped quote in the
    // Russian `info` field → JSON.parse "Expected ':' after property name".
    const { model, bound } = makeModel(
      vi
        .fn()
        .mockResolvedValue(
          new AIMessage({ content: '{"id": "coin-1", "info": "Делай "правильно" всегда"}' })
        )
    )
    // Corrective pass (unbound model, fresh minimal context) returns clean JSON
    vi.mocked(model.invoke).mockResolvedValue(
      new AIMessageChunk({ content: '{"id": "coin-1", "info": "KM# 190"}' })
    )

    const result = await querySingleCoinWithSearch(model, tool, coin, 'info', 'ru')

    expect(result.info).toEqual('KM# 190')
    expect(bound.invoke).toHaveBeenCalledTimes(1)
    expect(model.invoke).toHaveBeenCalledTimes(1)

    const nudgeMessages = vi.mocked(model.invoke).mock.calls[0][0] as BaseMessage[]
    const lastMsg = nudgeMessages[nudgeMessages.length - 1]
    expect(lastMsg).toBeInstanceOf(HumanMessage)
    expect(String(lastMsg.content)).toContain('валидным JSON')
  })

  it('surfaces the original error when the corrected JSON is still invalid', async () => {
    const tool = makeSearchTool(async () => 'unused')
    const { model, bound } = makeModel(
      vi.fn().mockResolvedValue(
        new AIMessage({ content: '{"id": "coin-1", "info": "say "hi""}' })
      )
    )
    vi.mocked(model.invoke).mockResolvedValue(new AIMessageChunk({ content: 'still not json' }))

    await expect(querySingleCoinWithSearch(model, tool, coin, 'info', 'en')).rejects.toThrow(
      /Failed to parse LLM response as JSON/
    )
    // exactly ONE corrective pass — no infinite retry
    expect(model.invoke).toHaveBeenCalledTimes(1)
    expect(bound.invoke).toHaveBeenCalledTimes(1)
  })

  it('does not leak a literal {coin} placeholder into the system prompt', async () => {
    const tool = makeSearchTool(async () => 'unused')
    const { model, bound } = makeModel(
      vi.fn().mockResolvedValue(new AIMessage({ content: '{"id": "coin-1", "info": "ok"}' }))
    )

    await querySingleCoinWithSearch(model, tool, coin, 'info', 'ru')

    const firstCallMessages = bound.invoke.mock.calls[0][0] as BaseMessage[]
    const systemMsg = firstCallMessages.find((m) => m instanceof SystemMessage)
    expect(systemMsg).toBeDefined()
    expect(String(systemMsg!.content)).not.toContain('{coin}')
  })
})
