import type { Country } from '@shared/types'

export async function fetchCountries(): Promise<Country[]> {
  const data = await window.api.countries.list()
  return data as Country[]
}

export async function createCountry(name: string): Promise<Country> {
  const data = await window.api.countries.create(name)
  return data as Country
}

export async function updateCountry(id: string, name: string): Promise<Country | null> {
  const data = await window.api.countries.update(id, name)
  return data as Country | null
}

export async function deleteCountry(id: string): Promise<boolean> {
  return window.api.countries.delete(id)
}
