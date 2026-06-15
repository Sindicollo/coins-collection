import { z } from 'zod'

/** Schema for a single coin's AI info in the LLM response */
export const AiCoinInfoSchema = z.object({
  id: z.string().describe('The coin ID from the input'),
  info: z
    .string()
    .optional()
    .describe('General information: historical context, design features, interesting facts'),
  price: z.string().optional().describe('Estimated current market price with source'),
  mintage: z.string().optional().describe('Mintage figures'),
  rarity: z.string().optional().describe('Rarity assessment'),
  varieties: z.array(z.string()).optional().describe('Known die or edge varieties')
})

/** Array of coin infos - the expected LLM output format */
export const AiCoinInfoArraySchema = z.array(AiCoinInfoSchema)

/** Inferred type from the schema */
export type AiCoinInfoOutput = z.infer<typeof AiCoinInfoSchema>

/** Validation: ensures response matches our schema */
export function validateAiResponse(data: unknown): { success: true; data: AiCoinInfoOutput[] } | { success: false; error: string } {
  const result = AiCoinInfoArraySchema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return { success: false, error: 'Response validation failed' }
}
