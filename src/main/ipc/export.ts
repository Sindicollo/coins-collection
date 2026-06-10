import { IPC_CHANNELS } from '@shared/constants'
import { exportCollectionsToExcel } from '../export/collection-excel'
import { registerExportHandler } from './export-common'

export function registerExportHandlers(): void {
  registerExportHandler({
    channel: IPC_CHANNELS.EXPORT.EXCEL,
    dialogTitle: 'Save Excel Export',
    defaultFilename: (opts) => {
      const locale = opts.locale as string
      const prefix = locale === 'ru' ? 'коллекция-монет' : 'coin-collection-export'
      return `${prefix}-${Date.now()}.xlsx`
    },
    filterName: 'Excel Files',
    extension: 'xlsx',
    generate: async (opts, sendProgress) => {
      return exportCollectionsToExcel({
        collectionIds: opts.collectionIds as string[],
        includeSold: opts.includeSold as boolean,
        includeImages: opts.includeImages as boolean,
        locale: opts.locale as 'en' | 'ru',
        onProgress: sendProgress
      })
    }
  })
}
