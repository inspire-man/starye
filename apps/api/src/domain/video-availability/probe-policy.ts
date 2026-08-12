export const VIDEO_MEDIA_CONTENT_TYPES = [
  'application/dash+xml',
  'application/ogg',
  'application/vnd.apple.mpegurl',
  'application/x-mpegurl',
  'audio/ogg',
  'video/mp2t',
  'video/mp4',
  'video/ogg',
  'video/webm',
  'video/x-flv',
] as const

export type VideoMediaContentType = typeof VIDEO_MEDIA_CONTENT_TYPES[number]
export type DirectProbeClassification
  = | 'challenge'
    | 'contradictory_media'
    | 'uncertain_media'
    | 'valid_media'

export const VIDEO_PROBE_POLICY_V1 = Object.freeze({
  browserTimeoutMs: 15_000,
  directTimeoutMs: 12_000,
  directTtlMs: 6 * 60 * 60 * 1000,
  magnetTtlMs: 30 * 60 * 1000,
  maxAbnormalSamples: 5,
  maxEvidenceRows: 20,
  maxRedirects: 3,
  maxResponseBytes: 64 * 1024,
  metadataTimeoutMs: 30_000,
  progressTimeoutMs: 60_000,
  rangeTimeoutMs: 5_000,
  version: 'video-source-probe/v1',
})

export function isAllowedVideoMediaContentType(value: string): value is VideoMediaContentType {
  const normalized = value.split(';', 1)[0]?.trim().toLowerCase() ?? ''
  return (VIDEO_MEDIA_CONTENT_TYPES as readonly string[]).includes(normalized)
}

export function shouldEscalateToBrowser(classification: DirectProbeClassification): boolean {
  return classification !== 'valid_media'
}
