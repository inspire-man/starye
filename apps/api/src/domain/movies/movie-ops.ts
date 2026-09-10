export const MOVIE_OPS_KINDS = [
  'backfill_covers',
  'backfill_previews',
  'recheck_players',
  'sync_metadata',
  'repair_relations',
] as const

export type MovieOpsKind = typeof MOVIE_OPS_KINDS[number]

export function classifyMovieOpsKind(operation: string, snapshot: unknown): MovieOpsKind {
  const text = JSON.stringify(snapshot ?? {}).toLowerCase()
  if (operation === 'repair_players' || text.includes('repair_players') || text.includes('recheck_video_source'))
    return 'recheck_players'
  if (text.includes('backfill-covers') || text.includes('missing-images') || text.includes('cover'))
    return 'backfill_covers'
  if (text.includes('preview'))
    return 'backfill_previews'
  if (text.includes('actor') || text.includes('publisher') || text.includes('relation'))
    return 'repair_relations'
  return 'sync_metadata'
}
