import '@testing-library/jest-dom'
import { vi } from 'vitest'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

// Initialize i18n for tests
i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: {
    en: {
      translation: {
        app: {
          title: 'Coin Collection',
          emptyState: 'Select a country from the sidebar to view its coins.',
          selected: 'Selected: {{name}}'
        },
        countries: {
          title: 'Countries',
          addButton: 'Add Country',
          placeholder: 'Country name...',
          add: 'Add',
          rename: 'Rename',
          delete: 'Delete',
          save: 'Save',
          cancel: 'Cancel',
          noCountries: 'No countries yet.',
          noCountriesHint: 'Add your first country above.',
          deleteTitle: 'Delete Country',
          deleteConfirm: 'Are you sure you want to delete',
          deleteWarning: 'This will also delete all coins and photos in this country.',
          errors: {
            loadFailed: 'Failed to load countries',
            createFailed: 'Failed to create country',
            updateFailed: 'Failed to update country',
            deleteFailed: 'Failed to delete country'
          }
        },
        form: {
          countryName: 'Country name',
          placeholder: 'e.g. Russia, USA, Germany...',
          create: 'Create',
          cancel: 'Cancel',
          errors: {
            required: 'Country name is required',
            tooShort: 'Country name must be at least 2 characters',
            tooLong: 'Country name must be less than 100 characters'
          }
        },
        lang: {
          label: 'Language',
          en: 'English',
          ru: 'Русский'
        }
      }
    }
  },
  interpolation: { escapeValue: false }
})

// Mock window.api (Electron preload bridge) for all tests
window.api = {
  countries: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  },
  coins: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  },
  photos: {
    list: vi.fn(),
    getPath: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    reorder: vi.fn()
  }
}
