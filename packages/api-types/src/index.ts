export type { AppType } from '../../../apps/api/dist/src/index'
export * from '@starye/config/storage-purpose-policy'

export type FavoriteEntityType = 'actor' | 'publisher' | 'movie' | 'comic'

export interface FavoriteEntity {
  name: string
  cover: string | null
  slug: string
}

export interface FavoriteItem {
  id: string
  userId: string
  entityType: FavoriteEntityType
  entityId: string
  createdAt: number
  entity?: FavoriteEntity | null
}

export interface FavoriteListMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface FavoriteListResponse {
  success: boolean
  data: FavoriteItem[]
  meta: FavoriteListMeta
  error?: string
}
