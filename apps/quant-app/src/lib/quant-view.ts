export const quantViews = ['overview', 'candidates', 'watchlist', 'knowledge'] as const

export type QuantView = typeof quantViews[number]

export function parseQuantView(hash: string): QuantView {
  const value = hash.replace(/^#/u, '').trim().toLowerCase()
  return quantViews.includes(value as QuantView) ? value as QuantView : 'overview'
}

export function quantViewHash(view: QuantView): string {
  return `#${view}`
}
