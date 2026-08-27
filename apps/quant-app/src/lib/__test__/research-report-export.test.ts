import type { QuantResearchRun, QuantResearchSummary } from '../quant-types'
import { describe, expect, it } from 'vitest'
import { buildResearchReportFilename, buildResearchReportMarkdown } from '../research-report-export'

function reportRun(overrides: Partial<QuantResearchRun['report']> = {}): QuantResearchRun {
  const report = {
    reportVersion: 'research-report-v2',
    tsCode: '600000.SH',
    name: '浦发银行',
    generatedAt: '2026-08-28T08:00:00.000Z',
    sourceSnapshotId: 'snapshot-1',
    status: 'partial' as const,
    action: 'wait-confirmation' as const,
    score: 72,
    headline: '等待更多经营质量证据',
    strengths: ['估值字段已返回'],
    risks: ['趋势仍需确认'],
    gaps: ['现金流数据缺失'],
    nextActions: ['补充下一期报告后复核'],
    evidence: [{
      key: 'pe-ttm',
      dimension: 'valuation',
      label: 'TTM PE',
      status: 'pass' as const,
      value: 8.5,
      threshold: '< 12',
      source: 'Eastmoney valuation',
      observedAt: '2026-08-27T08:00:00.000Z',
      formulaVersion: 'research-report-v2',
      detail: '估值处于观察范围',
      optional: false,
    }],
    sources: [{
      id: 'valuation',
      name: '估值快照',
      observedAt: '2026-08-27T08:00:00.000Z',
      formulaVersion: 'valuation-v1',
    }],
    ...overrides,
  }
  return {
    id: 'run-1',
    tsCode: report.tsCode,
    name: report.name,
    status: report.status,
    reportVersion: report.reportVersion,
    sourceSnapshotId: report.sourceSnapshotId,
    generatedAt: report.generatedAt,
    createdAt: report.generatedAt,
    report,
  }
}

function summary(): QuantResearchSummary {
  return {
    id: 'summary-1',
    researchRunId: 'run-1',
    summaryVersion: 'research-summary-v1',
    reportVersion: 'research-report-v2',
    provider: 'ollama',
    model: 'local-model',
    generatedAt: '2026-08-28T08:10:00.000Z',
    createdAt: '2026-08-28T08:10:00.000Z',
    summary: {
      summaryVersion: 'research-summary-v1',
      overview: '报告支持继续核对，但证据仍不完整。',
      supports: ['估值数据可用'],
      concerns: ['现金流字段缺失'],
      nextChecks: ['等待下一期报告'],
      citedEvidenceKeys: ['pe-ttm'],
    },
    citedEvidenceKeys: ['pe-ttm'],
  }
}

describe('research report Markdown export', () => {
  it('keeps report metadata, guidance, evidence provenance and sources', () => {
    const markdown = buildResearchReportMarkdown(reportRun())

    expect(markdown).toContain('# Quant 研究报告')
    expect(markdown).toContain('当前状态：部分可用')
    expect(markdown).toContain('研究动作：等待确认')
    expect(markdown).toContain('TTM PE')
    expect(markdown).toContain('原始值：8.5')
    expect(markdown).toContain('阈值：< 12')
    expect(markdown).toContain('来源：Eastmoney valuation')
    expect(markdown).toContain('估值快照')
  })

  it('keeps missing values explicit and includes an existing AI summary without its configuration', () => {
    const markdown = buildResearchReportMarkdown(reportRun({
      name: null,
      score: null,
      evidence: [],
      sources: [],
      gaps: [],
    }), summary())

    expect(markdown).toContain('名称待补齐')
    expect(markdown).toContain('研究分数：暂无数据')
    expect(markdown).toContain('暂无证据')
    expect(markdown).toContain('暂无来源快照')
    expect(markdown).toContain('## AI 摘要')
    expect(markdown).toContain('报告支持继续核对')
    expect(markdown).toContain('pe-ttm')
    expect(markdown).not.toContain('apiKey')
    expect(markdown).not.toContain('local-model')
  })

  it('normalizes stock codes and falls back to the report date for a stable filename', () => {
    const run = { ...reportRun({ tsCode: '600/000.SH' }), generatedAt: '2026-08-28T08:00:00.000Z' }
    expect(buildResearchReportFilename(run)).toBe('quant-research-600-000.SH-2026-08-28.md')
    const missingRunDate = { ...reportRun(), generatedAt: null }
    expect(buildResearchReportFilename(missingRunDate)).toBe('quant-research-600000.SH-2026-08-28.md')
  })

  it('uses an allowlist instead of serializing unapproved fields', () => {
    const run = {
      ...reportRun(),
      token: 'TOKEN',
      report: { ...reportRun().report, apiKey: 'API_KEY' },
    } as QuantResearchRun & { token: string, report: QuantResearchRun['report'] & { apiKey: string } }

    const markdown = buildResearchReportMarkdown(run)

    expect(markdown).not.toContain('TOKEN')
    expect(markdown).not.toContain('API_KEY')
  })
})
