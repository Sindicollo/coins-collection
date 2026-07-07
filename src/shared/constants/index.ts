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
  NOTE: {
    LIST: 'note:list',
    GET: 'note:get',
    CREATE: 'note:create',
    UPDATE: 'note:update',
    DELETE: 'note:delete',
    COUNT_BY_COIN: 'note:countByCoin'
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
  LLM: {
    GET_EXPORT_DATA: 'llm:getExportData',
    EXPORT_ALL: 'llm:exportAll',
    IMPORT_INFO: 'llm:importInfo',
    QUERY_BULK: 'llm:query-bulk',
    QUERY_SINGLE: 'llm:query-single',
    GET_CONFIG: 'llm:get-config',
    SET_CONFIG: 'llm:set-config',
    TEST_CONNECTION: 'llm:test-connection',
    BULK_PROGRESS: 'llm:bulk-progress',
    CANCEL_BULK: 'llm:cancel-bulk'
  },
  BACKUP: {
    EXPORT_EXECUTE: 'backup:export-execute',
    IMPORT_SELECT: 'backup:import-select',
    IMPORT_PREVIEW: 'backup:import-preview',
    IMPORT_EXECUTE: 'backup:import-execute'
  },
  EXPORT: {
    EXCEL: 'export:excel',
    PDF: 'export:pdf'
  }
} as const

export const APP_NAME = 'coin-collection'
export const PAGE_SIZE = 30
