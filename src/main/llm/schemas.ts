import { z } from 'zod'

/** Coerce string, number, or object to readable string */
const anythingToString = z
  .union([z.string(), z.number(), z.record(z.string(), z.unknown())])
  .transform((v) => {
    if (typeof v === 'string') return v
    if (typeof v === 'number') return String(v)
    // Format object as readable key: value pairs
    return Object.entries(v)
      .map(([k, val]) => `${k}: ${typeof val === 'object' ? JSON.stringify(val) : val}`)
      .join(', ')
  })

/** Coerce any variety format into string array */
const anyToVarieties = z
  .union([
    z.string(),
    z.array(z.unknown()),
    z.record(z.string(), z.unknown())
  ])
  .transform((v): string[] => {
    // Simple string
    if (typeof v === 'string') return [v]

    // Array: extract strings from each element
    if (Array.isArray(v)) {
      return v.map((item) => {
        if (typeof item === 'string') return item
        if (typeof item === 'object' && item !== null) {
          const obj = item as Record<string, unknown>
          if (typeof obj.name === 'string') return obj.name
          // Pick the first meaningful string value from the object
          for (const val of Object.values(obj)) {
            if (typeof val === 'string') return val
          }
        }
        return typeof item === 'object' ? JSON.stringify(item) : String(item)
      })
    }

    // Plain object: flatten values into strings
    if (typeof v === 'object' && v !== null) {
      return Object.entries(v as Record<string, unknown>).flatMap(([_key, val]) => {
        if (Array.isArray(val)) {
          return val.map((el) => (typeof el === 'string' ? el : typeof el === 'object' ? JSON.stringify(el) : String(el)))
        }
        return [typeof val === 'string' ? val : typeof val === 'object' ? JSON.stringify(val) : String(val)]
      })
    }

    return [String(v)]
  })

/** Schema for a single coin's AI info — lenient to handle various model outputs */
export const AiCoinInfoSchema = z
  .preprocess((val) => {
    if (typeof val !== 'object' || val === null) return val
    const obj = { ...val as Record<string, unknown> }  // Don't mutate input
    // Remap common alternative field names
    if (obj.estimated_value !== undefined && obj.price === undefined) {
      obj.price = obj.estimated_value
    }
    if (obj.catalog_number !== undefined && obj.info === undefined) {
      obj.info = obj.catalog_number
    }
    if (obj.denomination !== undefined && obj.info === undefined) {
      obj.info = `Denomination: ${obj.denomination}`
    }
    return obj
  }, z.object({
    id: z.string(),
    info: anythingToString.optional(),
    price: anythingToString.optional(),
    mintage: anythingToString.optional(),
    rarity: anythingToString.optional(),
    varieties: anyToVarieties.optional()
  })
  .passthrough())

/** Array of coin infos - the expected LLM output format */
export const AiCoinInfoArraySchema = z.array(AiCoinInfoSchema)

/** Inferred type from the schema */
export type AiCoinInfoOutput = z.infer<typeof AiCoinInfoSchema>

/** Validation: ensures response matches our schema */
export function validateAiResponse(
  data: unknown
): { success: true; data: AiCoinInfoOutput[] } | { success: false; error: string } {
  const result = AiCoinInfoArraySchema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  const issues = result.error?.issues?.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
  return {
    success: false,
    error: `Response validation failed${issues ? ': ' + issues : ''}`
  }
}
