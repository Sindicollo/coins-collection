import { ipcMain, dialog, BrowserWindow } from 'electron'
import { copyFileSync, existsSync, unlinkSync } from 'fs'

/** Options for `registerExportHandler` — one file per IPC channel. */
export interface ExportHandlerOptions {
  /** IPC channel string (from IPC_CHANNELS.EXPORT.*) */
  channel: string
  /** Title for the native save dialog (e.g. "Save PDF"). */
  dialogTitle: string
  /**
   * Default filename for the save dialog.
   * Receives the IPC options (includes `locale`) so locale-specific names
   * like `коллекция-монет-<timestamp>.pdf` can be generated.
   */
  defaultFilename: (opts: Record<string, unknown>) => string
  /** File filter name to display, e.g. "Excel Files" or "PDF Files". */
  filterName: string
  /** File extension, e.g. "xlsx" or "pdf". */
  extension: string
  /**
   * The actual export function.
   * Generates a temp file and returns its path, or null on failure.
   */
  generate: (
    opts: Record<string, unknown>,
    sendProgress: (stage: string, current: number, total: number, message: string) => void
  ) => Promise<string | null>
}

/**
 * Register a single IPC handler for an export channel (Excel or PDF).
 *
 * Encapsulates the common pattern:
 * 1. Get the BrowserWindow
 * 2. Create `sendProgress` wrapper for `export:progress`
 * 3. Call `generate` to produce the temp file
 * 4. Show native save dialog
 * 5. Copy temp file → cleanup temp → return chosen path
 */
export function registerExportHandler(options: ExportHandlerOptions): void {
  const { channel, dialogTitle, defaultFilename, filterName, extension, generate } = options

  ipcMain.handle(
    channel,
    async (
      event: Electron.IpcMainInvokeEvent,
      opts: Record<string, unknown>
    ): Promise<string | null> => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return null

      const sendProgress = (
        stage: string,
        current: number,
        total: number,
        message: string
      ) => {
        win.webContents.send('export:progress', { stage, current, total, message })
      }

      let tmpFilePath: string | null = null

      try {
        tmpFilePath = await generate(opts, sendProgress)

        if (!tmpFilePath || !existsSync(tmpFilePath)) {
          return null
        }
      } catch (err) {
        console.error(`[${channel}] Failed to generate export file:`, err)
        return null
      }

      const result = await dialog.showSaveDialog(win, {
        title: dialogTitle,
        defaultPath: defaultFilename(opts),
        filters: [{ name: filterName, extensions: [extension] }]
      })

      if (result.canceled || !result.filePath) {
        if (tmpFilePath && existsSync(tmpFilePath)) {
          unlinkSync(tmpFilePath)
        }
        return null
      }

      try {
        copyFileSync(tmpFilePath, result.filePath)
      } catch (err) {
        console.error(`[${channel}] Failed to copy export file:`, err)
        return null
      } finally {
        if (tmpFilePath && existsSync(tmpFilePath)) {
          unlinkSync(tmpFilePath)
        }
      }

      sendProgress('Done', 1, 1, 'Export complete')
      return result.filePath
    }
  )
}
