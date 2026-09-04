import type { QuantResearchReport } from '../quant-view-models'
import { describe, expect, it } from 'vitest'
import { buildQuantFactorDataHealth } from '../quant-factor-data-health'

function report(overrides: Partial<QuantResearchReport> = {}): QuantResearchReport {
  return {
    reportVersion: 'research-report-v2',
    tsCode: '601899.SH',
    name: '紫金矿业',
    generatedAt: '2026-08-30T00:00:00.000Z',
    sourceSnapshotId: 'snapshot-1',
    status: 'ready',
    action: 'research-window',
    score: 78,
    headline: '看多',
    strengths: [],
    risks: [],
    gaps: [],
    nextActions: [],
    evidence: [{
      key: 'quality-roe',
      dimension: 'quality',
      label: 'ROE',
      status: 'pass',
      value: 18,
      threshold: '至少 10%',
      source: 'Eastmoney 最新财报',
      observedAt: '20260829',
      formulaVersion: 'quality-v1',
      detail: 'ROE 达到门槛。',
    }, {
      key: 'valuation-pe',
      dimension: 'valuation',
      label: '市盈率',
      status: 'caution',
      value: 18,
      threshold: '样本中位数',
      source: 'Eastmoney 估值',
      observedAt: '20260830',
      formulaVersion: 'valuation-v1',
      detail: '估值需要继续核对。',
    }],
    sources: [
      { id: 'eastmoney-financial', name: 'Eastmoney 最新财报', observedAt: '20260829', formulaVersion: 'quality-v1' },
      { id: 'eastmoney-valuation', name: 'Eastmoney 估值', observedAt: '20260830', formulaVersion: 'valuation-v1' },
    ],
    factorModel: {
      modelVersion: 'research-factors-v1',
      totalWeight: 1,
      coveredWeight: 1,
      coverage: 100,
      score: 78,
      factors: [{
        key: 'quality',
        label: '盈利质量',
        weight: 0.6,
        sourceId: 'eastmoney-financial',
        source: 'Eastmoney 最新财报',
        status: 'ready',
        score: 20,
        evidenceKeys: ['quality-roe'],
        missingEvidenceKeys: [],
      }, {
        key: 'valuation',
        label: '估值',
        weight: 0.4,
        sourceId: 'eastmoney-valuation',
        source: 'Eastmoney 估值',
        status: 'ready',
        score: 70,
        evidenceKeys: ['valuation-pe'],
        missingEvidenceKeys: [],
      }],
    },
    decision: undefined,
    ...overrides,
  }
}

describe('buildQuantFactorDataHealth', () => {
  it('keeps low factor scores separate from complete raw data', () => {
    const result = buildQuantFactorDataHealth(report())

    expect(result).toMatchObject({
      version: 'quant-factor-data-health-v1',
      status: 'ready',
      label: '字段完整',
      sourceHealth: 'primary',
      totalWeight: 1,
      readyWeight: 1,
      coverage: 100,
    })
    expect(result.items[0]).toMatchObject({ status: 'ready', score: 20, freshness: { status: 'fresh', observedAt: '20260829', freshWithinDays: 180 }, evidenceCount: 1, usableEvidenceCount: 1, nextAction: expect.stringContaining('已具备原始证据') })
  })

  it('reports partial coverage and preserves missing and failed evidence keys', () => {
    const base = report()
    const result = buildQuantFactorDataHealth({
      ...base,
      evidence: [...base.evidence, {
        key: 'valuation-pb',
        dimension: 'valuation',
        label: '市净率',
        status: 'fail',
        value: null,
        threshold: '可用',
        source: 'Eastmoney 估值',
        observedAt: '20260830',
        formulaVersion: 'valuation-v1',
        detail: '字段读取失败。',
      }],
      factorModel: {
        ...base.factorModel!,
        factors: [
          base.factorModel!.factors[0]!,
          {
            ...base.factorModel!.factors[1]!,
            status: 'partial',
            evidenceKeys: ['valuation-pe', 'valuation-pb', 'valuation-dividend'],
            missingEvidenceKeys: ['valuation-dividend'],
          },
        ],
      },
    })

    expect(result).toMatchObject({ status: 'partial', readyWeight: 0.6, coverage: 60 })
    expect(result.items[1]).toMatchObject({
      status: 'partial',
      evidenceCount: 2,
      usableEvidenceCount: 1,
      missingEvidenceKeys: ['valuation-dividend'],
      failedEvidenceKeys: ['valuation-pb'],
      nextAction: '补齐证据：valuation-dividend',
    })
  })

  it('marks a factor unavailable separately from a missing factor', () => {
    const base = report()
    const result = buildQuantFactorDataHealth({
      ...base,
      factorModel: {
        ...base.factorModel!,
        factors: [{
          ...base.factorModel!.factors[0]!,
          status: 'unavailable',
          source: 'Eastmoney 财务来源不可用',
          evidenceKeys: [],
          missingEvidenceKeys: ['quality-roe'],
        }, {
          ...base.factorModel!.factors[1]!,
          status: 'missing',
          evidenceKeys: [],
          missingEvidenceKeys: ['valuation-pe'],
        }],
      },
    })

    expect(result).toMatchObject({ status: 'unavailable', label: '来源不可用', coverage: 0 })
    expect(result.items[0]).toMatchObject({ status: 'unavailable', sourceHealth: 'unavailable', nextAction: expect.stringContaining('检查') })
    expect(result.items[1]).toMatchObject({ status: 'missing', missingEvidenceKeys: ['valuation-pe'], nextAction: '补齐证据：valuation-pe' })
  })

  it('flags fallback source health without discarding usable fields', () => {
    const base = report()
    const result = buildQuantFactorDataHealth({
      ...base,
      factorModel: {
        ...base.factorModel!,
        factors: [{ ...base.factorModel!.factors[0]!, source: 'Eastmoney 财务，回退链：备用来源' }, base.factorModel!.factors[1]!],
      },
    })

    expect(result).toMatchObject({ status: 'ready', sourceHealth: 'fallback' })
    expect(result.items[0]).toMatchObject({ status: 'ready', sourceHealth: 'fallback', nextAction: '字段已读取，复核回退来源与观察时间' })
  })

  it('returns a missing summary when the report has no weighted factor model', () => {
    const result = buildQuantFactorDataHealth(report({ factorModel: undefined }))

    expect(result).toMatchObject({ status: 'missing', label: '待补数据', totalWeight: 0, readyWeight: 0, coverage: 0, items: [] })
  })
})
