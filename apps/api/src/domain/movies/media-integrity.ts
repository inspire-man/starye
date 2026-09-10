import { classifyStorageUrlKind } from '@starye/config/storage-purpose-policy'

export const MEDIA_FAILURE_REASON_CODES = [
  'source_unavailable',
  'http_probe_failed',
  'non_image',
  'image_decode_failed',
  'upload_failed',
] as const

export type MediaFailureReasonCode = typeof MEDIA_FAILURE_REASON_CODES[number]
export type MediaIntegrityKind = 'missing_value' | 'external_url' | 'invalid_url' | 'managed'

export interface BackfillReceiptSummary {
  processed: number
  succeeded: number
  failed: number
  skipped: number
  retried: number
  sources: string[]
  failureReasons: string[]
}

const REASON_SET = new Set<string>(MEDIA_FAILURE_REASON_CODES)

export function emptyMediaKindCounts(): Record<MediaIntegrityKind, number> {
  return { missing_value: 0, external_url: 0, invalid_url: 0, managed: 0 }
}

export function sanitizeMediaFailureReasons(value: unknown): MediaFailureReasonCode[] | undefined {
  if (!Array.isArray(value))
    return undefined
  const reasons = [...new Set(value.filter((item): item is MediaFailureReasonCode => typeof item === 'string' && REASON_SET.has(item)))].slice(0, 32)
  return reasons.length > 0 ? reasons : undefined
}

function numberField(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0
}

export function normalizeBackfillReceipt(value: unknown, failureCode: string | null): BackfillReceiptSummary {
  const receipt = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const counts = receipt.counts && typeof receipt.counts === 'object' && !Array.isArray(receipt.counts)
    ? receipt.counts as Record<string, unknown>
    : receipt
  const sources = [receipt.source, receipt.provider, receipt.sourceType]
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  const reasons = [
    ...(sanitizeMediaFailureReasons(receipt.mediaFailureReasons) ?? []),
    ...[receipt.failureReason, receipt.reason, failureCode].filter((item): item is string => typeof item === 'string' && item.trim().length > 0),
  ]
  const succeeded = numberField(counts.succeeded ?? counts.success ?? counts.createdCount ?? counts.updatedCount)
  const failed = numberField(counts.failed ?? counts.failures)
  const skipped = numberField(counts.skipped ?? counts.skips)
  const retried = numberField(counts.retried ?? counts.retries)
  const processed = numberField(counts.processed ?? counts.total) || succeeded + failed + skipped
  return {
    processed,
    succeeded,
    failed,
    skipped,
    retried,
    sources: [...new Set(sources)],
    failureReasons: [...new Set(reasons)],
  }
}

export function mediaIntegrityKind(value: string | null | undefined, r2PublicUrl?: string | null): MediaIntegrityKind {
  const kind = classifyStorageUrlKind(value, r2PublicUrl)
  if (kind === 'missing')
    return 'missing_value'
  if (kind === 'external')
    return 'external_url'
  if (kind === 'invalid')
    return 'invalid_url'
  return 'managed'
}

export function incrementMediaKind(counts: Record<MediaIntegrityKind, number>, kind: MediaIntegrityKind): void {
  counts[kind] += 1
}

export function countReceiptFailureReasons(summaries: readonly BackfillReceiptSummary[], code: MediaFailureReasonCode): number {
  return summaries.reduce((total, summary) => total + summary.failureReasons.filter(reason => reason === code).length, 0)
}

export function hasManagedMovieMedia(
  coverImage: string | null | undefined,
  previewImages: unknown,
  r2PublicUrl?: string | null,
): boolean {
  return classifyStorageUrlKind(coverImage, r2PublicUrl) === 'managed'
    && (previewImages == null || (Array.isArray(previewImages)
      && previewImages.every(image => typeof image === 'string' && classifyStorageUrlKind(image, r2PublicUrl) === 'managed')))
}
