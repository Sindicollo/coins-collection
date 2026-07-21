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
          emptyState: 'Select a collection from the sidebar to view its coins.',
          selected: 'Selected: {{name}}'
        },
        collections: {
          title: 'Collections',
          addButton: 'Add Collection',
          placeholder: 'Collection name...',
          add: 'Add',
          rename: 'Rename',
          delete: 'Delete',
          save: 'Save',
          cancel: 'Cancel',
          noCountries: 'No collections yet.',
          noCountriesHint: 'Add your first collection above.',
          deleteTitle: 'Delete Collection',
          deleteConfirm: 'Are you sure you want to delete',
          deleteWarning: 'This will also delete all coins and photos in this collection.',
          errors: {
            loadFailed: 'Failed to load collections',
            createFailed: 'Failed to create collection',
            updateFailed: 'Failed to update collection',
            deleteFailed: 'Failed to delete collection'
          }
        },
        form: {
          collectionName: 'Collection name',
          placeholder: 'e.g. Russia, USA, Germany...',
          create: 'Create',
          cancel: 'Cancel',
          errors: {
            required: 'Collection name is required',
            tooShort: 'Collection name must be at least 2 characters',
            tooLong: 'Collection name must be less than 100 characters'
          }
        },
        lang: {
          label: 'Language',
          en: 'English',
          ru: 'Русский'
        },
        settings: {
          title: 'Settings',
          general: 'General',
          language: 'Language',
          ai: 'AI',
          defaultCurrency: 'Default currency',
          currencyHint: 'New coins will use this currency by default.'
        },
        actions: {
          label: 'Actions'
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
          sold: 'Sold',
          onAuction: 'On auction',
          auctionPrice: 'Auction price',
          salePrice: 'Sale price',
          save: 'Save',
          cancel: 'Cancel',
          edit: 'Edit',
          delete: 'Delete',
          deleteTitle: 'Delete Coin',
          deleteConfirm: 'Are you sure you want to delete this coin?',
          createTitle: 'New Coin',
          editTitle: 'Edit Coin',
          selectCollection: 'Select a collection first',
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
          retry: 'Retry',
          back: 'Back',
          notFound: 'Coin not found',
          composition: 'Composition',
          compositions: {
            gold: 'Gold',
            silver: 'Silver',
            billon: 'Billon',
            copper: 'Copper',
            bronze: 'Bronze',
            other: 'Other'
          },
          exportLlm: 'Export for LLM',
          importLlm: 'Import from LLM',
          llmResult: '{{updated}} updated, {{skipped}} skipped',
          llmTemplate: 'LLM Prompt Template',
          llmCopied: 'Copied!',
          llmCopyPrompt: 'Copy prompt',
          llmLoadError: 'Failed to load collection data',
          llmExportTooltip: 'Paste this JSON into an AI chat and ask your questions — e.g. about current market prices, mintage, etc. See the prompt template below for an example. Important: the response must contain "id" and "info" fields only.',
          llmImportTooltip: 'Copy the JSON response from the AI chat into a file, then import it here to add the information to your coins.',
          llmPrompt: 'You are a professional numismatist-expert. For each coin in the JSON below, add useful information to the "info" field. USE WEB SEARCH if available.\n\nSEARCH PLAN for each coin:\n1. Identify the coin precisely: metal, weight, catalog numbers.\n2. Find the EXACT catalog number.\n3. Find RECENT market prices from eBay, Heritage, Violity.\n4. For silver/gold coins: calculate melt value.\n5. Quote price as a RANGE with currency.\n\nCRITICAL RULES:\n- Do NOT invent catalog numbers or prices.\n- Do NOT confuse denominations.\n\nIMPORTANT: Output ONLY a valid JSON array. Each object must have "id" and "info".\n\nHere is my coin collection:\n{{json}}\n\nExample response format:\n[\n  { "id": "abc-123", "info": "KM# 765. Silver 925, 28.28g. $80-150 VF+." }\n]'
        },
        photos: {
          title: 'Photos',
          photo: 'photo',
          photo_plural: 'photos',
          addPhoto: 'Add photo',
          deletePhoto: 'Delete photo',
          savePhoto: 'Save as file',
          noPhotos: 'No photos yet',
          clickToAdd: 'Click "Add photo" to add some.',
          deleteTitle: 'Delete Photo',
          deleteConfirm: 'Are you sure you want to delete this photo?',
          loadError: 'Failed to load image',
          dropError: 'Could not detect dropped files',
          viewGallery: 'Gallery'
        },
        ai: {
          title: 'AI',
          back: 'Back',
          bulkPrices: 'Learn Prices',
          bulkMintage: 'Learn Mintage',
          bulkInfo: 'Learn General Info',
          manualInput: 'Manual Input',
          settingsButton: 'Settings',
          querying: 'Querying...',
          queryingCollection: 'Asking AI about {{type}}...',
          loadingCoins: 'Loading coins...',
          pasteJson: 'Paste JSON response from AI chat (array of objects with "id" field):',
          parseJson: 'Parse JSON',
          appendToNotes: 'Append to Notes',
          savedToNotes: 'Saved to notes',
          clearResult: 'Clear',
          queryPrice: 'eBay price',
          queryMintage: 'Mintage',
          queryInfo: 'Info',
          progress: 'Processed {{processed}} of {{total}} coins',
          stop: 'Stop',
          resumeHint: 'Saved session: {{processed}} of {{total}} coins processed.',
          resume: 'Resume',
          discardSession: 'Discard',
          largeBulkWarning: 'Web search is enabled. Continue?',
          eta: '≈{{minutes}}m left',
          field: {
            price: 'Price',
            mintage: 'Mintage',
            rarity: 'Rarity',
            varieties: 'Varieties'
          },
          settings: {
            title: 'AI Settings',
            provider: 'Provider',
            baseUrl: 'Base URL',
            model: 'Model',
            apiKey: 'API Key',
            testConnection: 'Test Connection',
            testOk: 'Connection successful!',
            testFailed: 'Connection failed',
            saveError: 'Failed to save: {{message}}',
            webSearch: 'Enable web search',
            webSearchHint: 'When enabled, the model can call web_search tool to find current coin prices and data.',
            searchTitle: 'Search Configuration',
            searchProvider: 'Search Provider',
            searchApiKey: 'API Key',
            searchBaseUrl: 'Base URL',
            searchMaxResults: 'Max Results',
            searchHintTavily: 'Optimized for LLMs.',
            searchHintBrave: 'Good coverage.',
            searchHintDdg: 'No API key needed.',
            searchHintSearxng: 'Self-hosted metasearch.',
            toolCallSupported: 'Tool-calling: supported ✓',
            toolCallNotSupported: 'Tool-calling: not supported',
            searchTestOk: 'Search provider: ok ✓',
            searchTestFail: 'Search provider: unreachable'
          }
        },
        backup: {
          title: 'Backup & Restore',
          sectionBackup: 'Backup',
          sectionBackupTooltip: 'ZIP file with a full copy of the database contents, including photos',
          exportButton: 'Export Backup',
          importButton: 'Import Backup',
          exportFormats: 'Export Formats',
          exportFormatsTooltip: 'Export selected collections with coin metadata to PDF or .xslx (for Excel/Apple Numbers)',
          exportPdf: 'Export to PDF',
          exportExcel: 'Export to Excel',
          comingSoon: 'Coming soon',
          importTitle: 'Import Backup',
          loadingPreview: 'Loading preview…',
          date: 'Date:',
          appVersion: 'App version:',
          columnBackup: 'Backup',
          columnCurrent: 'Current',
          rowCollections: 'Collections',
          rowCoins: 'Coins',
          rowPhotos: 'Photos',
          mergeWarning: 'Existing records will be updated with data from the backup. New records will be added. No data will be deleted.',
          importAction: 'Import',
          cancel: 'Cancel',
          close: 'Close',
          exportFailed: 'Failed to create backup.',
          importPreviewFailed: 'Failed to read backup file.',
          importFailed: 'Failed to import backup.',
          exportProgress: 'Export Backup',
          importProgress: 'Import Backup',
          stageReading: 'Reading data…',
          stageCopyingPhotos: 'Copying photos…',
          stageArchiving: 'Creating archive…',
          stageExtracting: 'Extracting backup…',
          stageImportingCollections: 'Importing collections…',
          stageImportingCoins: 'Importing coins…',
          stageImportingPhotos: 'Importing photos…',
          stageCopyingFiles: 'Copying photo files…',
          stageFinalizing: 'Finalizing…',
          stageDone: 'Done!'
        },
        export: {
          title: 'Export to Excel',
          selectCollections: 'Select collections',
          noCollections: 'No collections found',
          selectAll: 'Select all',
          deselectAll: 'Deselect all',
          includeImages: 'Include images (base64, max 400px height)',
          includeSold: 'Include sold coins',
          cancel: 'Cancel',
          export: 'Export',
          exporting: 'Exporting…'
        },
        exportPdf: {
          title: 'Export to PDF',
          selectCollections: 'Select collections',
          noCollections: 'No collections found',
          selectAll: 'Select all',
          deselectAll: 'Deselect all',
          includeImages: 'Include photos',
          includeSold: 'Include sold coins',
          purchaseInfo: 'Purchase information',
          purchaseInfoNo: 'Without purchase info (denomination, year, country, condition, notes)',
          purchaseInfoYes: 'With purchase info (add price, date, place in gray text)',
          cancel: 'Cancel',
          export: 'Export PDF',
          exporting: 'Exporting…'
        },
        tabs: {
          details: 'Details',
          notes: 'Notes',
          photos: 'Photos'
        },
        notes: {
          title: 'Notes',
          add: 'Add Note',
          empty: 'No notes yet',
          readMore: 'Read more',
          created: 'Created',
          modified: 'Modified',
          titlePlaceholder: 'Title (optional)',
          contentPlaceholder: 'Note content…',
          aiEbay: 'eBay prices',
          aiInfo: 'Coin info',
          aiMintage: 'Mintage',
          aiResult: 'AI Result',
          aiEmpty: 'AI returned no data. Try again or check API key.'
        }
      }
    }
  },
  interpolation: { escapeValue: false }
})

// Mock window.api (Electron preload bridge) for all tests
// Only available in jsdom environment
if (typeof window !== 'undefined') {
  window.api = {
    collections: {
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
      listCountries: vi.fn(),
      totalCost: vi.fn()
    },
    notes: {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      countByCoin: vi.fn()
    },
    photos: {
      list: vi.fn(),
      getPhotoData: vi.fn(),
      create: vi.fn(),
      createFromPaths: vi.fn(),
      createFromFiles: vi.fn(),
      delete: vi.fn(),
      reorder: vi.fn(),
      save: vi.fn()
    },
    preferences: {
      getCurrency: vi.fn(),
      setCurrency: vi.fn(),
      getCurrencies: vi.fn()
    },
    import: {
      selectFile: vi.fn(),
      preview: vi.fn(),
      execute: vi.fn(),
      executeNoYear: vi.fn()
    },
    llm: {
      getExportData: vi.fn(),
      exportAll: vi.fn(),
      importInfo: vi.fn(),
      queryBulk: vi.fn(),
      querySingle: vi.fn(),
      getConfig: vi.fn(),
      setConfig: vi.fn(),
      testConnection: vi.fn(),
      onBulkProgress: vi.fn(() => vi.fn()),
      cancelBulk: vi.fn()
    },
    backup: {
      exportExecute: vi.fn(),
      importSelect: vi.fn(),
      importPreview: vi.fn(),
      importExecute: vi.fn(),
      onExportProgress: vi.fn(() => vi.fn()),
      onImportProgress: vi.fn(() => vi.fn())
    },
    export: {
      excel: vi.fn(),
      pdf: vi.fn(),
      onProgress: vi.fn(() => vi.fn())
    }
  }
}
