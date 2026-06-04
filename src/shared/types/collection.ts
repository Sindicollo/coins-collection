export interface Collection {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

export interface CreateCollectionInput {
  name: string
}

export interface UpdateCollectionInput {
  id: string
  name: string
}
