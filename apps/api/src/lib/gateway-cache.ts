const GATEWAY_CACHE_PREFIX = 'gateway-cache:v2'

export const gatewayCacheGroups = ['favorites', 'movies'] as const
export type GatewayCacheGroup = (typeof gatewayCacheGroups)[number]

function getGatewayCachePrefix(group: GatewayCacheGroup): string {
  return `${GATEWAY_CACHE_PREFIX}:${group}:`
}

async function collectKeysByPrefix(kv: KVNamespace, prefix: string): Promise<string[]> {
  const keys: string[] = []
  let cursor: string | undefined

  do {
    const result = await kv.list({ prefix, cursor })
    keys.push(...result.keys.map(key => key.name))
    cursor = result.list_complete ? undefined : result.cursor
  } while (cursor)

  return keys
}

export async function countGatewayCacheGroup(kv: KVNamespace | undefined, group: GatewayCacheGroup): Promise<number> {
  if (!kv) {
    return 0
  }

  const keys = await collectKeysByPrefix(kv, getGatewayCachePrefix(group))
  return keys.length
}

export async function clearGatewayCacheGroup(kv: KVNamespace | undefined, group: GatewayCacheGroup): Promise<number> {
  if (!kv) {
    return 0
  }

  const keys = await collectKeysByPrefix(kv, getGatewayCachePrefix(group))
  if (keys.length === 0) {
    return 0
  }

  await Promise.all(keys.map(key => kv.delete(key)))
  return keys.length
}

export async function clearGatewayCacheGroups(
  kv: KVNamespace | undefined,
  groups: GatewayCacheGroup[],
): Promise<Record<GatewayCacheGroup, number>> {
  const uniqueGroups = Array.from(new Set(groups))
  const result = {
    favorites: 0,
    movies: 0,
  } satisfies Record<GatewayCacheGroup, number>

  for (const group of uniqueGroups) {
    result[group] = await clearGatewayCacheGroup(kv, group)
  }

  return result
}

export async function getGatewayCacheStats(kv: KVNamespace | undefined): Promise<{
  groups: Record<GatewayCacheGroup, number>
  headers: string[]
  prefix: string
}> {
  return {
    groups: {
      favorites: await countGatewayCacheGroup(kv, 'favorites'),
      movies: await countGatewayCacheGroup(kv, 'movies'),
    },
    headers: ['X-Cache-Status', 'X-Cache-Group', 'X-Cache-Policy', 'X-Cache-TTL', 'Age'],
    prefix: GATEWAY_CACHE_PREFIX,
  }
}
