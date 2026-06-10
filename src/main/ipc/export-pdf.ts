import { IPC_CHANNELS } from '@shared/constants'
import { exportCollectionsToPdf } from '../export/collection-pdf'
import { registerExportHandler } from './export-common'

export function registerExportPdfHandlers(): void {
  registerExportHandler({
    channel: IPC_CHANNELS.EXPORT.PDF,
    dialogTitle: 'Save PDF',
    defaultFilename: (opts) => {
      const locale = opts.locale as string
      const prefix = locale === 'ru' ? 'коллекция-монет' : 'coin-collection'
      return `${prefix}-${Date.now()}.pdf`
    },
    filterName: 'PDF Files',
    extension: 'pdf',
    generate: async (opts, sendProgress) => {
      return exportCollectionsToPdf({
        collectionIds: opts.collectionIds as string[],
        includeSold: opts.includeSold as boolean,
        includeImages: opts.includeImages as boolean,
        includePurchaseInfo: opts.includePurchaseInfo as boolean,
        locale: opts.locale as 'en' | 'ru',
        onProgress: sendProgress
      })
    }
  })
}
