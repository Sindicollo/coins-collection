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

/** Payload for drag-and-drop file upload from renderer to main process */
export interface DropFileInput {
  originalName: string
  dataUrl: string
}
