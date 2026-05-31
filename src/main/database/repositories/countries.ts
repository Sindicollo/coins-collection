import { uuidv4 } from './uuid'
import { getDatabase } from '..'
import type { Country, CreateCountryInput, UpdateCountryInput } from '@shared/types'

interface CountryRow {
  id: string
  name: string
  created_at: number
  updated_at: number
}

function toCountry(row: CountryRow): Country {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function listCountries(): Country[] {
  const db = getDatabase()
  const rows = db.prepare('SELECT * FROM countries ORDER BY name').all() as CountryRow[]
  return rows.map(toCountry)
}

export function getCountry(id: string): Country | undefined {
  const db = getDatabase()
  const row = db.prepare('SELECT * FROM countries WHERE id = ?').get(id) as CountryRow | undefined
  return row ? toCountry(row) : undefined
}

export function createCountry(input: CreateCountryInput): Country {
  const db = getDatabase()
  const now = Date.now()
  const country: Country = {
    id: uuidv4(),
    name: input.name,
    createdAt: now,
    updatedAt: now
  }
  db.prepare('INSERT INTO countries (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(
    country.id,
    country.name,
    country.createdAt,
    country.updatedAt
  )
  return country
}

export function updateCountry(input: UpdateCountryInput): Country | undefined {
  const db = getDatabase()
  const existing = getCountry(input.id)
  if (!existing) return undefined

  const now = Date.now()
  db.prepare('UPDATE countries SET name = ?, updated_at = ? WHERE id = ?').run(
    input.name,
    now,
    input.id
  )
  return { ...existing, name: input.name, updatedAt: now }
}

export function deleteCountry(id: string): boolean {
  const db = getDatabase()
  const result = db.prepare('DELETE FROM countries WHERE id = ?').run(id)
  return result.changes > 0
}
