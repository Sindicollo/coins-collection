export const IPC_CHANNELS = {
  COLLECTION: {
    LIST: 'collection:list',
    GET: 'collection:get',
    CREATE: 'collection:create',
    UPDATE: 'collection:update',
    DELETE: 'collection:delete'
  },
  COIN: {
    LIST: 'coin:list',
    GET: 'coin:get',
    CREATE: 'coin:create',
    UPDATE: 'coin:update',
    DELETE: 'coin:delete',
    LIST_DISTINCT_COUNTRIES: 'coin:listCountries',
    TOTAL_COST: 'coin:totalCost'
  },
  PHOTO: {
    LIST: 'photo:list',
    GET_PATH: 'photo:get-path',
    CREATE: 'photo:create',
    CREATE_FROM_PATHS: 'photo:create-from-paths',
    CREATE_FROM_FILES: 'photo:create-from-files',
    DELETE: 'photo:delete',
    REORDER: 'photo:reorder',
    SAVE: 'photo:save'
  },
  IMPORT: {
    SELECT_FILE: 'import:select-file',
    PREVIEW: 'import:preview',
    EXECUTE: 'import:execute',
    EXECUTE_NO_YEAR: 'import:execute-no-year'
  },
  PRICE: {
    EXPORT_ALL: 'price:exportAll',
    IMPORT_PRICES: 'price:importPrices'
  },
  BACKUP: {
    EXPORT_EXECUTE: 'backup:export-execute',
    IMPORT_SELECT: 'backup:import-select',
    IMPORT_PREVIEW: 'backup:import-preview',
    IMPORT_EXECUTE: 'backup:import-execute'
  }
} as const

export const APP_NAME = 'coin-collection'
export const PAGE_SIZE = 30
