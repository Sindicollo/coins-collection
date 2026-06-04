import type { Collection } from '@shared/types'

export async function fetchCollections(): Promise<Collection[]> {
  const data = await window.api.collections.list()
  return data as Collection[]
}

export async function createCollection(name: string): Promise<Collection> {
  const data = await window.api.collections.create(name)
  return data as Collection
}

export async function updateCollection(id: string, name: string): Promise<Collection | null> {
  const data = await window.api.collections.update(id, name)
  return data as Collection | null
}

export async function deleteCollection(id: string): Promise<boolean> {
  return window.api.collections.delete(id)
}
