import { ipcMain } from 'electron'
import * as prefsRepo from '../database/repositories/preferences'

export function registerPreferenceHandlers(): void {
  ipcMain.handle('pref:getCurrency', async () => {
    return prefsRepo.getDefaultCurrency()
  })

  ipcMain.handle('pref:setCurrency', async (_event, currency: string) => {
    prefsRepo.setDefaultCurrency(currency)
    return currency
  })

  ipcMain.handle('pref:getCurrencies', async () => {
    return prefsRepo.SUPPORTED_CURRENCIES.map((c) => ({
      code: c.code,
      symbol: c.symbol,
      name: c.name
    }))
  })
}
