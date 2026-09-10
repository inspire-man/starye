export type MediaStatus = 'missing_value' | 'external_url' | 'managed' | 'load_failed'

export function classifyMediaStatus(url: string | null | undefined): MediaStatus {
  if (!url || url.trim().length === 0)
    return 'missing_value'
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? 'external_url' : 'load_failed'
  }
  catch {
    return 'load_failed'
  }
}

export function canRenderMedia(url: string | null | undefined, failed = false): boolean {
  const status = classifyMediaStatus(url)
  return !failed && status !== 'missing_value' && status !== 'load_failed'
}
