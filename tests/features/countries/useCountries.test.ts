import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useCountryManager } from '@/features/countries/useCountries'
import * as countryApi from '@/features/countries/api'

vi.mock('@/features/countries/api', () => ({
  fetchCountries: vi.fn(),
  createCountry: vi.fn(),
  updateCountry: vi.fn(),
  deleteCountry: vi.fn()
}))

const mockCountries = [
  { id: '1', name: 'Russia', createdAt: 1000, updatedAt: 1000 },
  { id: '2', name: 'USA', createdAt: 2000, updatedAt: 2000 },
  { id: '3', name: 'Germany', createdAt: 3000, updatedAt: 3000 }
]

describe('useCountryManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('loadCountries', () => {
    it('should load countries and set loading=false', async () => {
      vi.mocked(countryApi.fetchCountries).mockResolvedValue(mockCountries)

      const { result } = renderHook(() => useCountryManager())

      expect(result.current.loading).toBe(false)
      expect(result.current.countries).toEqual([])

      await act(async () => {
        await result.current.loadCountries()
      })

      expect(result.current.countries).toEqual(mockCountries)
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should set error on failure', async () => {
      vi.mocked(countryApi.fetchCountries).mockRejectedValue(new Error('DB Error'))

      const { result } = renderHook(() => useCountryManager())

      await act(async () => {
        await result.current.loadCountries()
      })

      expect(result.current.error).toBe('countries.errors.loadFailed')
      expect(result.current.loading).toBe(false)
    })
  })

  describe('addCountry', () => {
    it('should add country to list and select it', async () => {
      vi.mocked(countryApi.fetchCountries).mockResolvedValue([])
      const newCountry = { id: '4', name: 'France', createdAt: 4000, updatedAt: 4000 }
      vi.mocked(countryApi.createCountry).mockResolvedValue(newCountry)

      const { result } = renderHook(() => useCountryManager())

      await act(async () => {
        await result.current.loadCountries()
      })

      await act(async () => {
        const country = await result.current.addCountry('France')
        expect(country).toEqual(newCountry)
      })

      expect(result.current.countries).toContainEqual(newCountry)
      expect(result.current.selectedId).toBe('4')
    })

    it('should set error on create failure', async () => {
      vi.mocked(countryApi.fetchCountries).mockResolvedValue([])
      vi.mocked(countryApi.createCountry).mockRejectedValue(new Error('DB Error'))

      const { result } = renderHook(() => useCountryManager())

      await act(async () => {
        await result.current.loadCountries()
      })

      await act(async () => {
        const country = await result.current.addCountry('Fail')
        expect(country).toBeNull()
      })

      expect(result.current.error).toBe('countries.errors.createFailed')
    })
  })

  describe('updateCountry', () => {
    it('should update country name in list', async () => {
      vi.mocked(countryApi.fetchCountries).mockResolvedValue(mockCountries)
      const updated = { ...mockCountries[0], name: 'Russian Federation' }
      vi.mocked(countryApi.updateCountry).mockResolvedValue(updated)

      const { result } = renderHook(() => useCountryManager())

      await act(async () => {
        await result.current.loadCountries()
      })

      await act(async () => {
        const res = await result.current.updateCountry('1', 'Russian Federation')
        expect(res).toEqual(updated)
      })

      expect(result.current.countries.find((c) => c.id === '1')?.name).toBe('Russian Federation')
    })

    it('should return null if update fails', async () => {
      vi.mocked(countryApi.fetchCountries).mockResolvedValue(mockCountries)
      vi.mocked(countryApi.updateCountry).mockRejectedValue(new Error('Not found'))

      const { result } = renderHook(() => useCountryManager())

      await act(async () => {
        await result.current.loadCountries()
      })

      await act(async () => {
        const res = await result.current.updateCountry('1', 'New Name')
        expect(res).toBeNull()
      })

      expect(result.current.error).toBe('countries.errors.updateFailed')
    })
  })

  describe('deleteCountry', () => {
    it('should remove country and clear selection', async () => {
      vi.mocked(countryApi.fetchCountries).mockResolvedValue(mockCountries)
      vi.mocked(countryApi.deleteCountry).mockResolvedValue(true)

      const { result } = renderHook(() => useCountryManager())

      await act(async () => {
        await result.current.loadCountries()
      })

      // Select the country first
      act(() => {
        result.current.selectCountry('1')
      })
      expect(result.current.selectedId).toBe('1')

      await act(async () => {
        const success = await result.current.deleteCountry('1')
        expect(success).toBe(true)
      })

      expect(result.current.countries.find((c) => c.id === '1')).toBeUndefined()
      expect(result.current.selectedId).toBeNull()
    })

    it('should not clear selection if deleting different country', async () => {
      vi.mocked(countryApi.fetchCountries).mockResolvedValue(mockCountries)
      vi.mocked(countryApi.deleteCountry).mockResolvedValue(true)

      const { result } = renderHook(() => useCountryManager())

      await act(async () => {
        await result.current.loadCountries()
      })
      act(() => {
        result.current.selectCountry('1')
      })

      await act(async () => {
        await result.current.deleteCountry('2')
      })

      expect(result.current.selectedId).toBe('1')
    })
  })

  describe('selectCountry', () => {
    it('should update selectedCountryId', () => {
      const { result } = renderHook(() => useCountryManager())

      act(() => {
        result.current.selectCountry('2')
      })

      expect(result.current.selectedId).toBe('2')
    })
  })
})
