import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import * as countryRepo from '../database/repositories/countries'
import type { CreateCountryInput, UpdateCountryInput } from '@shared/types'

export function registerCountryHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.COUNTRY.LIST, async () => {
    return countryRepo.listCountries()
  })

  ipcMain.handle(IPC_CHANNELS.COUNTRY.GET, async (_event, id: string) => {
    return countryRepo.getCountry(id) ?? null
  })

  ipcMain.handle(IPC_CHANNELS.COUNTRY.CREATE, async (_event, input: CreateCountryInput) => {
    return countryRepo.createCountry(input)
  })

  ipcMain.handle(IPC_CHANNELS.COUNTRY.UPDATE, async (_event, input: UpdateCountryInput) => {
    return countryRepo.updateCountry(input) ?? null
  })

  ipcMain.handle(IPC_CHANNELS.COUNTRY.DELETE, async (_event, id: string) => {
    return countryRepo.deleteCountry(id)
  })
}
