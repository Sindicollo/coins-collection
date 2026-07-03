import React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'

function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

interface SheetPreview {
  name: string
  coinCount: number
  photoCount: number
  embeddedPhotoCount: number
  sampleRows: Array<{
    year: number | null
    denomination: string
    price: number | null
    shippingCost: number | null
    purchaseDate: number | null
    purchasePlace: string | null
    notes: string | null
    photoUrls: string[]
    embeddedImages: Array<{
      rowIndex: number
      colIndex: number
      imagePath: string
    }>
  }>
}

interface PreviewData {
  filePath: string
  sheets: SheetPreview[]
}

interface ImportResult {
  collectionsCreated: number
  collectionsSkipped: number
  coinsCreated: number
  photosImported: number
  errors: string[]
}

type ImportStep = 'select' | 'preview' | 'importing' | 'done'

interface ImportViewProps {
  open: boolean
  onClose: () => void
}

export function ImportView({ open, onClose }: ImportViewProps): React.ReactElement {
  const { t } = useTranslation()
  const [step, setStep] = React.useState<ImportStep>('select')
  const [preview, setPreview] = React.useState<PreviewData | null>(null)
  const [collectionOverrides, setCollectionOverrides] = React.useState<Record<string, string>>({})
  const [importPhotos, setImportPhotos] = React.useState(true)
  const [result, setResult] = React.useState<ImportResult | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)

  const reset = React.useCallback(() => {
    setStep('select')
    setPreview(null)
    setCollectionOverrides({})
    setImportPhotos(true)
    setResult(null)
    setError(null)
    setLoading(false)
  }, [])

  const handleClose = React.useCallback(() => {
    reset()
    onClose()
  }, [reset, onClose])

  const handleSelectFile = async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const filePath = await window.api.import.selectFile()
      if (!filePath) {
        setLoading(false)
        return
      }

      const previewData = await window.api.import.preview(filePath)
      setPreview(previewData)
      setStep('preview')
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async (): Promise<void> => {
    if (!preview) return
    setStep('importing')
    setError(null)

    try {
      const importResult = await window.api.import.execute({
        filePath: preview.filePath,
        collectionOverrides,
        downloadPhotos: importPhotos
      })
      setResult(importResult)
      setStep('done')
    } catch (err) {
      setError(toErrorMessage(err))
      setStep('preview')
    }
  }

  const handleImportNoYear = async (): Promise<void> => {
    if (!preview) return
    setStep('importing')
    setError(null)

    try {
      const importResult = await window.api.import.executeNoYear({
        filePath: preview.filePath,
        collectionOverrides,
        downloadPhotos: importPhotos
      })
      setResult(importResult)
      setStep('done')
    } catch (err) {
      setError(toErrorMessage(err))
      setStep('preview')
    }
  }

  const getCollectionName = (sheetName: string): string => {
    return collectionOverrides[sheetName] ?? sheetName
  }

  const handleCollectionNameChange = (sheetName: string, newName: string): void => {
    setCollectionOverrides((prev) => ({ ...prev, [sheetName]: newName }))
  }

  return (
    <Modal open={open} onClose={handleClose} title={t('import.title')}>
      <div className="space-y-4">
        {/* Step: Select */}
        {step === 'select' && (
          <>
            <p className="text-sm text-gray-600">{t('import.selectHint')}</p>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={handleClose}>
                {t('collections.cancel')}
              </Button>
              <Button size="sm" onClick={handleSelectFile} disabled={loading}>
                {loading ? t('import.loading') : t('import.selectFile')}
              </Button>
            </div>
          </>
        )}

        {/* Step: Preview */}
        {step === 'preview' && preview && (
          <>
            <p className="text-sm text-gray-600">
              {t('import.previewHint')}
            </p>

            {preview.sheets.map((sheet) => (
              <div key={sheet.name} className="border border-gray-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-gray-500">
                    {t('import.collectionName')}:
                  </label>
                  <input
                    type="text"
                    value={getCollectionName(sheet.name)}
                    onChange={(e) => handleCollectionNameChange(sheet.name, e.target.value)}
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm
                      focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
                <div className="flex gap-4 text-xs text-gray-500">
                  <span>{t('import.coins')}: {sheet.coinCount}</span>
                  <span>{t('import.photos')}: {sheet.embeddedPhotoCount}</span>
                </div>

                {/* Sample rows */}
                {sheet.sampleRows.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-500 border-b">
                          <th className="py-1 text-left">{t('coins.year')}</th>
                          <th className="py-1 text-left">{t('coins.denomination')}</th>
                          <th className="py-1 text-right">{t('coins.price')}</th>
                          <th className="py-1 text-right">{t('coins.shippingCost')}</th>
                          <th className="py-1 text-left">{t('coins.purchasePlace')}</th>
                          <th className="py-1 text-center">{t('import.photos')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sheet.sampleRows.map((row, i) => (
                          <tr key={i} className="border-b border-gray-100">
                            <td className="py-1">{row.year ?? '—'}</td>
                            <td className="py-1">{row.denomination}</td>
                            <td className="py-1 text-right">
                              {row.price !== null ? `₽${row.price.toFixed(2)}` : '—'}
                            </td>
                            <td className="py-1 text-right">
                              {row.shippingCost !== null
                                ? `₽${row.shippingCost.toFixed(2)}`
                                : '—'}
                            </td>
                            <td className="py-1">{row.purchasePlace ?? '—'}</td>
                            <td className="py-1 text-center">{row.embeddedImages.length}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}

            {/* Options */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="import-photos"
                checked={importPhotos}
                onChange={(e) => setImportPhotos(e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="import-photos" className="text-sm text-gray-700">
                {t('import.importPhotos')}
              </label>
            </div>

            {/* Errors */}
            {error && (
              <div className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={handleClose}>
                {t('collections.cancel')}
              </Button>
              <Button size="sm" onClick={handleImport}>
                {t('import.start')}
              </Button>
              <Button size="sm" variant="secondary" onClick={handleImportNoYear}>
                {t('import.importNoYear')}
              </Button>
            </div>
          </>
        )}

        {/* Step: Importing */}
        {step === 'importing' && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4" />
            <p className="text-sm text-gray-600">{t('import.importing')}</p>
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && result && (
          <>
            <div className="space-y-2 text-sm">
              <p className="text-green-700 font-medium">{t('import.complete')}</p>
              <ul className="text-gray-600 space-y-1">
                <li>
                  {t('import.collectionsCreated')}: {result.collectionsCreated}
                </li>
                <li>
                  {t('import.collectionsSkipped')}: {result.collectionsSkipped}
                </li>
                <li>
                  {t('import.coinsCreated')}: {result.coinsCreated}
                </li>
                <li>
                  {t('import.photosImported')}: {result.photosImported}
                </li>
              </ul>

              {result.errors.length > 0 && (
                <div className="mt-3 p-2 bg-red-50 rounded">
                  <p className="text-red-700 font-medium text-xs mb-1">
                    {t('import.errors')}:
                  </p>
                  <ul className="text-xs text-red-600 space-y-0.5">
                    {result.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end mt-4">
              <Button size="sm" onClick={handleClose}>
                {t('collections.save')}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
