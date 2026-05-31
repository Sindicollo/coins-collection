import { create } from 'zustand'
import type { Country } from '@shared/types'

interface CollectionState {
  countries: Country[]
  selectedCountryId: string | null
  loading: boolean
  error: string | null

  // Actions
  selectCountry: (id: string) => void
  loadCountries: () => Promise<void>
  addCountry: (name: string) => Promise<void>
  updateCountry: (id: string, name: string) => Promise<void>
  deleteCountry: (id: string) => Promise<void>
  setError: (error: string | null) => void
}

export const useCollectionStore = create<CollectionState>((set) => ({
  countries: [],
  selectedCountryId: null,
  loading: false,
  error: null,

  selectCountry: (id: string) => set({ selectedCountryId: id }),

  loadCountries: async () => {
    set({ loading: true, error: null })
    try {
      const countries = await window.api.countries.list()
      set({ countries: countries as Country[], loading: false })
    } catch (_err) {
      set({ error: 'Failed to load countries', loading: false })
    }
  },

  addCountry: async (name: string) => {
    set({ error: null })
    try {
      const country = await window.api.countries.create(name)
      set((state) => ({
        countries: [...state.countries, country as Country],
        selectedCountryId: (country as Country).id
      }))
    } catch (_err) {
      set({ error: 'Failed to create country' })
    }
  },

  updateCountry: async (id: string, name: string) => {
    set({ error: null })
    try {
      const updated = await window.api.countries.update(id, name)
      if (updated) {
        set((state) => ({
          countries: state.countries.map((c) =>
            c.id === id ? (updated as Country) : c
          )
        }))
      }
    } catch (_err) {
      set({ error: 'Failed to update country' })
    }
  },

  deleteCountry: async (id: string) => {
    set({ error: null })
    try {
      const success = await window.api.countries.delete(id)
      if (success) {
        set((state) => ({
          countries: state.countries.filter((c) => c.id !== id),
          selectedCountryId:
            state.selectedCountryId === id ? null : state.selectedCountryId
        }))
      }
    } catch (_err) {
      set({ error: 'Failed to delete country' })
    }
  },

  setError: (error: string | null) => set({ error })
}))
