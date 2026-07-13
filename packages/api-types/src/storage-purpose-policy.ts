export const manualUploadPurposeValues = [
  'cover',
  'avatar',
  'logo',
  'blog_inline',
  'manual_asset',
  'fallback',
  'temp',
] as const

export type ManualUploadPurpose = (typeof manualUploadPurposeValues)[number]

export const manualUploadPrefixMap = {
  cover: 'covers/manual/',
  avatar: 'avatars/manual/',
  logo: 'logos/manual/',
  blog_inline: 'manual-assets/blog-inline/',
  manual_asset: 'manual-assets/uploads/',
  fallback: 'fallback/manual/',
  temp: 'tmp/manual/',
} as const satisfies Record<ManualUploadPurpose, string>

const manualUploadPurposeSet = new Set<ManualUploadPurpose>(manualUploadPurposeValues)

export function isManualUploadPurpose(value: string): value is ManualUploadPurpose {
  return manualUploadPurposeSet.has(value as ManualUploadPurpose)
}

export const crawlerImagePurposeValues = ['cover', 'avatar', 'logo'] as const

export type CrawlerImagePurpose = (typeof crawlerImagePurposeValues)[number]
