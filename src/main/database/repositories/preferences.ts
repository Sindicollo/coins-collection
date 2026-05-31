import { getDatabase } from '..'

export function getPreference(key: string): string | undefined {
  const db = getDatabase()
  const row = db.prepare('SELECT value FROM preferences WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row?.value
}

export function setPreference(key: string, value: string): void {
  const db = getDatabase()
  db.prepare('INSERT OR REPLACE INTO preferences (key, value) VALUES (?, ?)').run(key, value)
}

export function getDefaultCurrency(): string {
  return getPreference('currency') ?? 'RUB'
}

export function setDefaultCurrency(currency: string): void {
  setPreference('currency', currency)
}

export const SUPPORTED_CURRENCIES = [
  { code: 'RUB', symbol: '₽', name: 'Russian Ruble' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'UAH', symbol: '₴', name: 'Ukrainian Hryvnia' },
  { code: 'KZT', symbol: '₸', name: 'Kazakhstani Tenge' },
  { code: 'BYN', symbol: 'Br', name: 'Belarusian Ruble' }
] as const

export function getCurrencySymbol(code: string): string {
  return SUPPORTED_CURRENCIES.find((c) => c.code === code)?.symbol ?? code
}

export function getCurrencyName(code: string): string {
  return SUPPORTED_CURRENCIES.find((c) => c.code === code)?.name ?? code
}
