import type { QuantValuationSnapshot } from './provider'

export interface QuantValuationComparisonSample {
  readonly tsCode: string
  readonly name: string | null
  readonly valuation: QuantValuationSnapshot | null
}

export interface QuantValuationComparisonPeer {
  readonly tsCode: string
  readonly name: string | null
  readonly valuation: QuantValuationSnapshot | null
}

export interface QuantValuationComparison {
  readonly target: QuantValuationSnapshot
  readonly peers: readonly QuantValuationComparisonPeer[]
  readonly sampleCount: number
  readonly availableSampleCount: number
  readonly ttmPeSampleCount: number
  readonly pbSampleCount: number
  readonly ttmPeHigherThanPercent: number | null
  readonly pbHigherThanPercent: number | null
}

function higherThanPercent(target: number | null, peerValues: readonly (number | null)[]): number | null {
  if (target === null)
    return null
  const values = peerValues.filter((value): value is number => value !== null)
  if (values.length < 2)
    return null
  return Math.round((values.filter(value => target > value).length / values.length) * 100)
}

export function buildQuantValuationComparison(
  targetTsCode: string,
  samples: readonly QuantValuationComparisonSample[],
): QuantValuationComparison {
  const targetSample = samples.find(sample => sample.tsCode === targetTsCode)
  if (!targetSample?.valuation)
    throw new Error('Quant valuation comparison target is unavailable')

  const peers = samples
    .filter(sample => sample.tsCode !== targetTsCode)
    .map(sample => ({
      tsCode: sample.tsCode,
      name: sample.name,
      valuation: sample.valuation,
    } satisfies QuantValuationComparisonPeer))
  const allValuations = samples.map(sample => sample.valuation).filter((value): value is QuantValuationSnapshot => value !== null)
  const peerValuations = peers.map(peer => peer.valuation)

  return {
    target: targetSample.valuation,
    peers,
    sampleCount: samples.length,
    availableSampleCount: allValuations.length,
    ttmPeSampleCount: allValuations.filter(value => value.peTtm !== null).length,
    pbSampleCount: allValuations.filter(value => value.pb !== null).length,
    ttmPeHigherThanPercent: higherThanPercent(targetSample.valuation.peTtm, peerValuations.map(value => value?.peTtm ?? null)),
    pbHigherThanPercent: higherThanPercent(targetSample.valuation.pb, peerValuations.map(value => value?.pb ?? null)),
  }
}
