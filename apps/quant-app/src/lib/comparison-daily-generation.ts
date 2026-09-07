export interface ComparisonDailyGeneration {
  readonly next: () => number
  readonly invalidate: () => number
  readonly isCurrent: (generation: number) => boolean
}

export function createComparisonDailyGeneration(initial = 0): ComparisonDailyGeneration {
  let current = initial

  return {
    next: () => ++current,
    invalidate: () => ++current,
    isCurrent: generation => generation === current,
  }
}
