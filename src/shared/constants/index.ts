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
    LIST_DISTINCT_COUNTRIES: 'coin:listCountries'
  },
  PHOTO: {
    LIST: 'photo:list',
    GET_PATH: 'photo:get-path',
    CREATE: 'photo:create',
    DELETE: 'photo:delete',
    REORDER: 'photo:reorder'
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
  }
} as const

export const APP_NAME = 'coin-collection'
export const PAGE_SIZE = 30
