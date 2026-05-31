import { useCallback } from 'react'
import { create } from 'zustand'
import type { Country } from '@shared/types'
import * as countryApi from './api'

interface CountryState {
  countries: Country[]
  selectedCountryId: string | null
  loading: boolean
  error: string | null
}

interface CountryActions {
  selectCountry: (id: string) => void
  loadCountries: () => Promise<void>
  addCountry: (name: string) => Promise<Country | null>
  updateCountry: (id: string, name: string) => Promise<Country | null>
  deleteCountry: (id: string) => Promise<boolean>
}

type CountryStore = CountryState & CountryActions

const useCountryStore = create<CountryStore>((set) => ({
  countries: [],
  selectedCountryId: null,
  loading: false,
  error: null,

  selectCountry: (id: string) => set({ selectedCountryId: id }),

  loadCountries: async () => {
    set({ loading: true, error: null })
    try {
      const countries = await countryApi.fetchCountries()
      set({ countries, loading: false })
    } catch {
      set({ error: 'countries.errors.loadFailed', loading: false })
    }
  },

  addCountry: async (name: string) => {
    set({ error: null })
    try {
      const country = await countryApi.createCountry(name)
      set((state) => ({
        countries: [...state.countries, country],
        selectedCountryId: country.id
      }))
      return country
    } catch {
      set({ error: 'countries.errors.createFailed' })
      return null
    }
  },

  updateCountry: async (id: string, name: string) => {
    set({ error: null })
    try {
      const updated = await countryApi.updateCountry(id, name)
      if (updated) {
        set((state) => ({
          countries: state.countries.map((c) => (c.id === id ? updated : c))
        }))
      }
      return updated
    } catch {
      set({ error: 'countries.errors.updateFailed' })
      return null
    }
  },

  deleteCountry: async (id: string) => {
    set({ error: null })
    try {
      const success = await countryApi.deleteCountry(id)
      if (success) {
        set((state) => ({
          countries: state.countries.filter((c) => c.id !== id),
          selectedCountryId: state.selectedCountryId === id ? null : state.selectedCountryId
        }))
      }
      return success
    } catch {
      set({ error: 'countries.errors.deleteFailed' })
      return false
    }
  }
}))

export function useCountryManager() {
  const {
    countries,
    selectedCountryId,
    loading,
    error,
    selectCountry,
    loadCountries,
    addCountry,
    updateCountry,
    deleteCountry
  } = useCountryStore()

  return {
    countries,
    selectedId: selectedCountryId,
    loading,
    error,
    selectCountry: useCallback((id: string) => selectCountry(id), [selectCountry]),
    loadCountries: useCallback(() => loadCountries(), [loadCountries]),
    addCountry: useCallback((name: string) => addCountry(name), [addCountry]),
    updateCountry: useCallback((id: string, name: string) => updateCountry(id, name), [updateCountry]),
    deleteCountry: useCallback((id: string) => deleteCountry(id), [deleteCountry])
  }
}
