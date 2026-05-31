export interface Country {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

export interface CreateCountryInput {
  name: string
}

export interface UpdateCountryInput {
  id: string
  name: string
}
