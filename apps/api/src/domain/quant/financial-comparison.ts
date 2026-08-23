import type { QuantFinancialQualitySnapshot } from './provider'

export interface QuantFinancialQualityComparisonSample {
  readonly tsCode: string
  readonly name: string | null
  readonly quality: QuantFinancialQualitySnapshot | null
}
export interface QuantFinancialQualityComparisonPeer {
  readonly tsCode: string
  readonly name: string | null
  readonly quality: QuantFinancialQualitySnapshot | null
}

export interface QuantFinancialQualityComparison {
  readonly target: QuantFinancialQualitySnapshot
  readonly peers: readonly QuantFinancialQualityComparisonPeer[]
  readonly sampleCount: number
  readonly availableSampleCount: number
  readonly revenueYoYSampleCount: number
  readonly netProfitYoYSampleCount: number
  readonly roeSampleCount: number
  readonly debtAssetRatioSampleCount: number
  readonly revenueYoYHigherThanPercent: number | null
  readonly netProfitYoYHigherThanPercent: number | null
  readonly roeHigherThanPercent: number | null
  readonly debtAssetRatioLowerThanPercent: number | null
}

function relativePercent(
  target: number | null,
  peerValues: readonly (number | null)[],
  isAhead: (target: number, peer: number) => boolean,
): number | null {
  if (target === null)
    return null
  const values = peerValues.filter((value): value is number => value !== null)
  if (values.length < 2)
    return null
  return Math.round((values.filter(value => isAhead(target, value)).length / values.length) * 100)
}

export function buildQuantFinancialQualityComparison(
  targetTsCode: string,
  samples: readonly QuantFinancialQualityComparisonSample[],
): QuantFinancialQualityComparison {
  const targetSample = samples.find(sample => sample.tsCode === targetTsCode)
  if (!targetSample?.quality)
    throw new Error('Quant financial quality comparison target is unavailable')

  const peers = samples
    .filter(sample => sample.tsCode !== targetTsCode)
    .map(sample => ({
      tsCode: sample.tsCode,
      name: sample.name,
      quality: sample.quality,
    } satisfies QuantFinancialQualityComparisonPeer))
  const allQuality = samples.map(sample => sample.quality).filter((value): value is QuantFinancialQualitySnapshot => value !== null)
  const peerQuality = peers.map(peer => peer.quality)

  return {
    target: targetSample.quality,
    peers,
    sampleCount: samples.length,
    availableSampleCount: allQuality.length,
    revenueYoYSampleCount: allQuality.filter(value => value.revenueYoY !== null).length,
    netProfitYoYSampleCount: allQuality.filter(value => value.netProfitYoY !== null).length,
    roeSampleCount: allQuality.filter(value => value.roe !== null).length,
    debtAssetRatioSampleCount: allQuality.filter(value => value.debtAssetRatio !== null).length,
    revenueYoYHigherThanPercent: relativePercent(targetSample.quality.revenueYoY, peerQuality.map(value => value?.revenueYoY ?? null), (left, right) => left > right),
    netProfitYoYHigherThanPercent: relativePercent(targetSample.quality.netProfitYoY, peerQuality.map(value => value?.netProfitYoY ?? null), (left, right) => left > right),
    roeHigherThanPercent: relativePercent(targetSample.quality.roe, peerQuality.map(value => value?.roe ?? null), (left, right) => left > right),
    debtAssetRatioLowerThanPercent: relativePercent(targetSample.quality.debtAssetRatio, peerQuality.map(value => value?.debtAssetRatio ?? null), (left, right) => left < right),
  }
}
