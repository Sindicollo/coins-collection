import { uuidv4 } from './uuid'
import { getDatabase } from '..'
import type {
  Coin,
  CoinComposition,
  CreateCoinInput,
  UpdateCoinInput,
  PaginatedResult
} from '@shared/types'
import { PAGE_SIZE } from '@shared/constants'

interface CursorData {
  denomination: string
  year: number | null
  id: string
}

function encodeCursor(data: CursorData | null): string | null {
  if (!data) return null
  return Buffer.from(JSON.stringify(data)).toString('base64')
}

function decodeCursor(cursor: string): CursorData {
  return JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'))
}

function optionalJSON(value: string | null): Record<string, unknown> | null {
  if (!value) return null
  try {
    return JSON.parse(value) as Record<string, unknown>
  } catch {
    return null
  }
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  return Number(value)
}

export function listCoins(
  collectionId: string,
  cursor: string | null,
  limit: number = PAGE_SIZE
): PaginatedResult<Coin> {
  const db = getDatabase()

  let rows

  if (cursor) {
    const { denomination, year, id }: CursorData = decodeCursor(cursor)

    rows = db
      .prepare(
        `SELECT * FROM coins
         WHERE collection_id = ?
           AND (denomination > ? OR (denomination = ? AND (year > ? OR (year IS ? AND ? IS NULL) OR (year = ? AND id > ?)))
                 OR (denomination = ? AND year IS NULL AND ? IS NOT NULL))
         ORDER BY denomination, year IS NULL, year, id
         LIMIT ?`
      )
      .all(
        collectionId,
        denomination,
        denomination,
        year,
        year,
        year === null ? 1 : 0,
        year,
        id,
        denomination,
        year === null ? 0 : 1,
        limit + 1
      )
  } else {
    rows = db
      .prepare(
        `SELECT * FROM coins
         WHERE collection_id = ?
         ORDER BY denomination, year IS NULL, year, id
         LIMIT ?`
      )
      .all(collectionId, limit + 1)
  }

  const hasMore = rows.length > limit
  const items = rows.slice(0, limit) as Array<Record<string, unknown>>

  const coins: Coin[] = items.map((row) => ({
    id: row.id as string,
    collectionId: row.collection_id as string,
    denomination: row.denomination as string,
    year: row.year as number | null,
    condition: row.condition as Coin['condition'],
    purchaseDate: row.purchase_date as number | null,
    purchasePlace: row.purchase_place as string | null,
    price: nullableNumber(row.price),
    shippingCost: nullableNumber(row.shipping_cost),
    currency: (row.currency as string) ?? null,
    country: (row.country as string) ?? null,
    composition: (row.composition as CoinComposition) ?? null,
    notes: row.notes as string | null,
    extraData: optionalJSON(row.extra_data as string | null),
    sold: (row.sold as number) === 1,
    onAuction: (row.on_auction as number) === 1,
    auctionPrice: nullableNumber(row.auction_price),
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number
  }))

  let nextCursor: string | null = null
  if (hasMore && coins.length > 0) {
    const last = coins[coins.length - 1]
    nextCursor = encodeCursor({
      denomination: last.denomination,
      year: last.year,
      id: last.id
    })
  }

  return { items: coins, nextCursor, hasMore }
}

export function getCoin(id: string): Coin | undefined {
  const db = getDatabase()
  const row = db.prepare('SELECT * FROM coins WHERE id = ?').get(id) as Record<
    string,
    unknown
  > | undefined
  if (!row) return undefined

  return {
    id: row.id as string,
    collectionId: row.collection_id as string,
    denomination: row.denomination as string,
    year: row.year as number | null,
    condition: row.condition as Coin['condition'],
    purchaseDate: row.purchase_date as number | null,
    purchasePlace: row.purchase_place as string | null,
    price: nullableNumber(row.price),
    shippingCost: nullableNumber(row.shipping_cost),
    currency: (row.currency as string) ?? null,
    country: (row.country as string) ?? null,
    composition: (row.composition as CoinComposition) ?? null,
    notes: row.notes as string | null,
    extraData: optionalJSON(row.extra_data as string | null),
    sold: (row.sold as number) === 1,
    onAuction: (row.on_auction as number) === 1,
    auctionPrice: nullableNumber(row.auction_price),
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number
  }
}

export function createCoin(input: CreateCoinInput): Coin {
  const db = getDatabase()
  const now = Date.now()
  const id = uuidv4()

  db.prepare(
    `INSERT INTO coins (id, collection_id, denomination, year, condition, composition,
      purchase_date, purchase_place, price, shipping_cost, currency, country, notes, extra_data,
      sold, on_auction, auction_price, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.collectionId,
    input.denomination,
    input.year ?? null,
    input.condition ?? null,
    input.composition ?? null,
    input.purchaseDate ?? null,
    input.purchasePlace ?? null,
    input.price ?? null,
    input.shippingCost ?? null,
    input.currency ?? null,
    input.country ?? null,
    input.notes ?? null,
    input.extraData ? JSON.stringify(input.extraData) : null,
    input.sold ? 1 : 0,
    input.onAuction ? 1 : 0,
    input.auctionPrice ?? null,
    now,
    now
  )

  return {
    id,
    collectionId: input.collectionId,
    denomination: input.denomination,
    year: input.year ?? null,
    condition: input.condition ?? null,
    purchaseDate: input.purchaseDate ?? null,
    purchasePlace: input.purchasePlace ?? null,
    price: input.price ?? null,
    shippingCost: input.shippingCost ?? null,
    currency: input.currency ?? null,
    country: input.country ?? null,
    composition: input.composition ?? null,
    notes: input.notes ?? null,
    extraData: input.extraData ?? null,
    sold: input.sold ?? false,
    onAuction: input.onAuction ?? false,
    auctionPrice: input.auctionPrice ?? null,
    createdAt: now,
    updatedAt: now
  }
}

export function updateCoin(input: UpdateCoinInput): Coin | undefined {
  const existing = getCoin(input.id)
  if (!existing) return undefined

  const db = getDatabase()
  const now = Date.now()

  const fields = { ...existing }
  if (input.collectionId !== undefined) fields.collectionId = input.collectionId
  if (input.denomination !== undefined) fields.denomination = input.denomination
  if (input.year !== undefined) fields.year = input.year ?? null
  if (input.condition !== undefined) fields.condition = input.condition ?? null
  if (input.purchaseDate !== undefined) fields.purchaseDate = input.purchaseDate ?? null
  if (input.purchasePlace !== undefined) fields.purchasePlace = input.purchasePlace ?? null
  if (input.price !== undefined) fields.price = input.price ?? null
  if (input.shippingCost !== undefined) fields.shippingCost = input.shippingCost ?? null
  if (input.currency !== undefined) fields.currency = input.currency ?? null
  if (input.country !== undefined) fields.country = input.country ?? null
  if (input.composition !== undefined) fields.composition = input.composition ?? null
  if (input.notes !== undefined) fields.notes = input.notes ?? null
  if (input.extraData !== undefined) fields.extraData = input.extraData ?? null
  if (input.sold !== undefined) fields.sold = input.sold
  if (input.onAuction !== undefined) fields.onAuction = input.onAuction
  if (input.auctionPrice !== undefined) fields.auctionPrice = input.auctionPrice ?? null
  fields.updatedAt = now

  db.prepare(
    `UPDATE coins SET collection_id = ?, denomination = ?, year = ?, condition = ?, composition = ?,
     purchase_date = ?, purchase_place = ?, price = ?, shipping_cost = ?, currency = ?, country = ?,
     notes = ?, extra_data = ?, sold = ?, on_auction = ?, auction_price = ?, updated_at = ? WHERE id = ?`
  ).run(
    fields.collectionId,
    fields.denomination,
    fields.year,
    fields.condition,
    fields.composition,
    fields.purchaseDate,
    fields.purchasePlace,
    fields.price,
    fields.shippingCost,
    fields.currency,
    fields.country,
    fields.notes,
    fields.extraData ? JSON.stringify(fields.extraData) : null,
    fields.sold ? 1 : 0,
    fields.onAuction ? 1 : 0,
    fields.auctionPrice,
    fields.updatedAt,
    input.id
  )

  return fields as Coin
}

export function deleteCoin(id: string): boolean {
  const db = getDatabase()
  const result = db.prepare('DELETE FROM coins WHERE id = ?').run(id)
  return result.changes > 0
}

export function listDistinctCountries(): string[] {
  const db = getDatabase()
  const rows = db
    .prepare(
      `SELECT DISTINCT country FROM coins WHERE country IS NOT NULL AND country != '' ORDER BY country`
    )
    .all() as Array<{ country: string }>
  return rows.map((r) => r.country)
}

export function listAllCoins(): Coin[] {
  const db = getDatabase()
  const rows = db
    .prepare(
      `SELECT * FROM coins ORDER BY country, denomination, year IS NULL, year, id`
    )
    .all() as Array<Record<string, unknown>>

  return rows.map((row) => ({
    id: row.id as string,
    collectionId: row.collection_id as string,
    denomination: row.denomination as string,
    year: row.year as number | null,
    condition: row.condition as Coin['condition'],
    purchaseDate: row.purchase_date as number | null,
    purchasePlace: row.purchase_place as string | null,
    price: nullableNumber(row.price),
    shippingCost: nullableNumber(row.shipping_cost),
    currency: (row.currency as string) ?? null,
    country: (row.country as string) ?? null,
    composition: (row.composition as CoinComposition) ?? null,
    notes: row.notes as string | null,
    extraData: optionalJSON(row.extra_data as string | null),
    sold: (row.sold as number) === 1,
    onAuction: (row.on_auction as number) === 1,
    auctionPrice: nullableNumber(row.auction_price),
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number
  }))
}

export function listCoinsByCollection(collectionId: string): Coin[] {
  const db = getDatabase()
  const rows = db
    .prepare(
      `SELECT * FROM coins WHERE collection_id = ? ORDER BY denomination, year IS NULL, year, id`
    )
    .all(collectionId) as Array<Record<string, unknown>>

  return rows.map((row) => ({
    id: row.id as string,
    collectionId: row.collection_id as string,
    denomination: row.denomination as string,
    year: row.year as number | null,
    condition: row.condition as Coin['condition'],
    purchaseDate: row.purchase_date as number | null,
    purchasePlace: row.purchase_place as string | null,
    price: nullableNumber(row.price),
    shippingCost: nullableNumber(row.shipping_cost),
    currency: (row.currency as string) ?? null,
    country: (row.country as string) ?? null,
    composition: (row.composition as CoinComposition) ?? null,
    notes: row.notes as string | null,
    extraData: optionalJSON(row.extra_data as string | null),
    sold: (row.sold as number) === 1,
    onAuction: (row.on_auction as number) === 1,
    auctionPrice: nullableNumber(row.auction_price),
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number
  }))
}

export interface LlmNoteUpdate {
  id: string
  info: string
}

export interface BulkAppendResult {
  updated: number
  skipped: number
}

export function bulkAppendLlmInfo(updates: LlmNoteUpdate[]): BulkAppendResult {
  const db = getDatabase()
  const getStmt = db.prepare('SELECT notes FROM coins WHERE id = ?')
  const setStmt = db.prepare(
    'UPDATE coins SET notes = ?, updated_at = ? WHERE id = ?'
  )

  let updated = 0
  let skipped = 0

  const now = Date.now()
  const tx = db.transaction((items: LlmNoteUpdate[]): void => {
    for (const item of items) {
      const row = getStmt.get(item.id) as { notes: string | null } | undefined
      if (!row) {
        skipped++
        continue
      }
      const newNotes =
        row.notes && row.notes !== '' ? row.notes + '\n\n' + item.info : item.info
      setStmt.run(newNotes, now, item.id)
      updated++
    }
  })

  tx(updates)
  return { updated, skipped }
}

export interface CurrencyTotal {
  currency: string
  total: number
  coinCount: number
}

export function getCollectionTotalCost(collectionId: string): CurrencyTotal[] {
  const db = getDatabase()
  const rows = db
    .prepare(
      `SELECT currency,
              SUM(COALESCE(price, 0) + COALESCE(shipping_cost, 0)) as total,
              COUNT(*) as coin_count
       FROM coins
       WHERE collection_id = ? AND (sold IS NULL OR sold = 0)
       GROUP BY currency
       ORDER BY total DESC`
    )
    .all(collectionId) as Array<{ currency: string | null; total: number; coin_count: number }>

  return rows
    .filter((r) => r.total > 0)
    .map((r) => ({
      currency: r.currency ?? 'RUB',
      total: r.total,
      coinCount: r.coin_count
    }))
}
