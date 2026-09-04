import type { Database } from '@starye/db'
import type { QuantStockBasicProvider } from './provider'
import type { QuantSyncInput, QuantSyncResult } from './types'
import { createQuantWatchlistItem, deleteQuantWatchlistItem, ensureQuantStarterWatchlist, getQuantSyncState, listQuantDailyBars, listQuantWatchlistWithStats, updateQuantWatchlistItem } from './repository'
import { syncQuantDaily } from './sync'

export async function readQuantWatchlistWorkspace(db: Database, userId: string) {
  await ensureQuantStarterWatchlist(db, userId)
  return listQuantWatchlistWithStats(db, userId)
}

export async function createQuantWatchlistWorkspaceItem(
  db: Database,
  provider: QuantStockBasicProvider,
  input: { readonly userId: string, readonly tsCode: string, readonly name?: string | null },
) {
  let name = input.name?.trim() || null
  if (!name) {
    try {
      name = (await provider.fetchStockBasic({ tsCode: input.tsCode })).name
    }
    catch {
      name = null
    }
  }

  let data = await createQuantWatchlistItem(db, { userId: input.userId, tsCode: input.tsCode, name })
  if (!data.name && name)
    data = await updateQuantWatchlistItem(db, input.userId, input.tsCode, name)
  return data
}

export function updateQuantWatchlistWorkspaceItem(db: Database, userId: string, tsCode: string, name: string | null) {
  return updateQuantWatchlistItem(db, userId, tsCode, name)
}

export function deleteQuantWatchlistWorkspaceItem(db: Database, userId: string, tsCode: string) {
  return deleteQuantWatchlistItem(db, userId, tsCode)
}

export function readQuantStockBasic(provider: QuantStockBasicProvider, tsCode: string) {
  return provider.fetchStockBasic({ tsCode })
}

export async function readQuantDailyBars(
  db: Database,
  input: { readonly tsCode: string, readonly fromDate?: string, readonly toDate?: string, readonly limit: number },
) {
  const data = await listQuantDailyBars(db, {
    tsCode: input.tsCode,
    ...(input.fromDate ? { fromDate: input.fromDate } : {}),
    ...(input.toDate ? { toDate: input.toDate } : {}),
  })
  return data.slice(-input.limit)
}

export function readQuantSyncState(db: Database, userId: string) {
  return getQuantSyncState(db, userId)
}

export async function runQuantDailySync(
  db: Database,
  env: unknown,
  input: QuantSyncInput,
  userId: string,
): Promise<QuantSyncResult> {
  await ensureQuantStarterWatchlist(db, userId)
  return syncQuantDaily(db, env, input, { userId })
}
