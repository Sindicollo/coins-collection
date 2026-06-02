export const IPC_CHANNELS = {
  COUNTRY: {
    LIST: 'country:list',
    GET: 'country:get',
    CREATE: 'country:create',
    UPDATE: 'country:update',
    DELETE: 'country:delete'
  },
  COIN: {
    LIST: 'coin:list',
    GET: 'coin:get',
    CREATE: 'coin:create',
    UPDATE: 'coin:update',
    DELETE: 'coin:delete',
    LIST_COUNTRIES: 'coin:listCountries'
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
    EXECUTE: 'import:execute'
  }
} as const

export const APP_NAME = 'coin-collection'
export const PAGE_SIZE = 30
