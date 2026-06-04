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
        },
        settings: {
          title: 'Settings',
          defaultCurrency: 'Default currency',
          currencyHint: 'New coins will use this currency by default.'
        },
        coins: {
          title: 'Coins',
          addButton: 'Add Coin',
          noCoins: 'No coins in this collection yet.',
          noCoinsHint: 'Click "Add Coin" to start your collection.',
          denomination: 'Denomination',
          year: 'Year',
          condition: 'Condition',
          purchaseDate: 'Purchase date',
          purchasePlace: 'Purchase place',
          price: 'Price',
          shippingCost: 'Shipping',
          currency: 'Currency',
          notes: 'Notes',
          save: 'Save',
          cancel: 'Cancel',
          edit: 'Edit',
          delete: 'Delete',
          deleteTitle: 'Delete Coin',
          deleteConfirm: 'Are you sure you want to delete this coin?',
          createTitle: 'New Coin',
          editTitle: 'Edit Coin',
          selectCountry: 'Select a country first',
          conditions: {
            UNC: 'Uncirculated (UNC)',
            XF: 'Extremely Fine (XF)',
            VF: 'Very Fine (VF)',
            F: 'Fine (F)',
            VG: 'Very Good (VG)',
            G: 'Good (G)',
            'F-2': 'Fair (F-2)',
            'F-1': 'Poor (F-1)'
          },
          errors: {
            loadFailed: 'Failed to load coins',
            createFailed: 'Failed to create coin',
            updateFailed: 'Failed to update coin',
            deleteFailed: 'Failed to delete coin',
            denominationRequired: 'Denomination is required'
          },
          retry: 'Retry'
        },
        photos: {
          title: 'Photos',
          photo: 'photo',
          photo_plural: 'photos',
          addPhoto: 'Add photo',
          deletePhoto: 'Delete photo',
          noPhotos: 'No photos yet',
          clickToAdd: 'Click "Add photo" to add some.',
          deleteTitle: 'Delete Photo',
          deleteConfirm: 'Are you sure you want to delete this photo?',
          loadError: 'Failed to load image'
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
    delete: vi.fn(),
    listCountries: vi.fn()
  },
  photos: {
    list: vi.fn(),
    getPhotoData: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    reorder: vi.fn()
  },
  preferences: {
    getCurrency: vi.fn(),
    setCurrency: vi.fn(),
    getCurrencies: vi.fn()
  },
  import: {
    selectFile: vi.fn(),
    preview: vi.fn(),
    execute: vi.fn()
  },
  prices: {
    exportAll: vi.fn(),
    importPrices: vi.fn()
  }
}
