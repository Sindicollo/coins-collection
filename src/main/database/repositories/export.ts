import { getDatabase } from '..'
import type { Collection, Photo, CoinNote } from '@shared/types'

interface CollectionRow {
  id: string
  name: string
  created_at: number
  updated_at: number
}

interface CoinRow {
  id: string
  collection_id: string
  denomination: string
  year: number | null
  condition: string | null
  purchase_date: number | null
  purchase_place: string | null
  price: number | null
  shipping_cost: number | null
  currency: string | null
  country: string | null
  extra_data: string | null
  sold: number
  composition: string | null
  on_auction: number
  auction_price: number | null
  sale_price: number | null
  created_at: number
  updated_at: number
}

interface PhotoRow {
  id: string
  coin_id: string
  filename: string
  original_name: string | null
  position: number
  created_at: number
}

interface CoinNoteRow {
  id: string
  coin_id: string
  title: string | null
  content: string
  created_at: number
  updated_at: number
}

export interface AllData {
  collections: Collection[]
  coins: Array<{
    id: string
    collectionId: string
    denomination: string
    year: number | null
    condition: string | null
    purchaseDate: number | null
    purchasePlace: string | null
    price: number | null
    shippingCost: number | null
    currency: string | null
    country: string | null
    composition: string | null
    extraData: string | null
    sold: boolean
    onAuction: boolean
    auctionPrice: number | null
    salePrice: number | null
    createdAt: number
    updatedAt: number
  }>
  photos: Photo[]
  notes: CoinNote[]
  preferences: Record<string, string>
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  return Number(value)
}

export function getAllCollections(): Collection[] {
  const db = getDatabase()
  const rows = db.prepare('SELECT * FROM collections ORDER BY name').all() as CollectionRow[]
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }))
}

export function getAllCoins(): AllData['coins'] {
  const db = getDatabase()
  const rows = db
    .prepare('SELECT * FROM coins ORDER BY denomination, year IS NULL, year, id')
    .all() as CoinRow[]

  return rows.map((r) => ({
    id: r.id,
    collectionId: r.collection_id,
    denomination: r.denomination,
    year: r.year,
    condition: r.condition,
    purchaseDate: r.purchase_date,
    purchasePlace: r.purchase_place,
    price: nullableNumber(r.price),
    shippingCost: nullableNumber(r.shipping_cost),
    currency: r.currency,
    country: r.country,
    composition: r.composition,
    extraData: r.extra_data,
    sold: r.sold === 1,
    onAuction: r.on_auction === 1,
    auctionPrice: nullableNumber(r.auction_price),
    salePrice: nullableNumber(r.sale_price),
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }))
}

export function getAllNotes(): CoinNote[] {
  const db = getDatabase()
  const rows = db
    .prepare('SELECT * FROM coin_notes ORDER BY created_at')
    .all() as CoinNoteRow[]

  return rows.map((r) => ({
    id: r.id,
    coinId: r.coin_id,
    title: r.title ?? null,
    content: r.content,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }))
}

export function getAllPhotos(): Photo[] {
  const db = getDatabase()
  const rows = db
    .prepare('SELECT * FROM photos ORDER BY created_at')
    .all() as PhotoRow[]

  return rows.map((r) => ({
    id: r.id,
    coinId: r.coin_id,
    filename: r.filename,
    originalName: r.original_name,
    position: r.position,
    createdAt: r.created_at
  }))
}

export function getAllPreferences(): Record<string, string> {
  const db = getDatabase()
  const rows = db
    .prepare('SELECT key, value FROM preferences')
    .all() as Array<{ key: string; value: string }>

  const prefs: Record<string, string> = {}
  for (const row of rows) {
    prefs[row.key] = row.value
  }
  return prefs
}

export function getLocalStats(): { collections: number; coins: number; photos: number } {
  const db = getDatabase()
  const collections = db.prepare('SELECT COUNT(*) as c FROM collections').get() as { c: number }
  const coins = db.prepare('SELECT COUNT(*) as c FROM coins').get() as { c: number }
  const photos = db.prepare('SELECT COUNT(*) as c FROM photos').get() as { c: number }
  return {
    collections: collections.c,
    coins: coins.c,
    photos: photos.c
  }
}
