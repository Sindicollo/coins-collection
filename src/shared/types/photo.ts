export interface Photo {
  id: string
  coinId: string
  filename: string
  originalName: string | null
  position: number
  createdAt: number
}

export interface CreatePhotoInput {
  coinId: string
  filename: string
  originalName?: string | null
  position?: number
}
