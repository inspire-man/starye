import type { QuantResearchRun } from './quant-view-models'
import { buildResearchReportMarkdown } from './research-report-export'

function reportDate(run: QuantResearchRun): string {
  return (run.generatedAt || run.report.generatedAt).match(/^\d{4}-\d{2}-\d{2}/)?.[0] || 'unknown-date'
}

function uniqueRuns(runs: readonly QuantResearchRun[]): QuantResearchRun[] {
  const seen = new Set<string>()
  return runs.filter((run) => {
    if (seen.has(run.tsCode))
      return false
    seen.add(run.tsCode)
    return true
  })
}

function withoutReportTitle(markdown: string): string {
  return markdown.replace(/^# Quant 研究报告\r?\n/, '')
}

export function buildResearchBatchMarkdown(
  runs: readonly QuantResearchRun[],
  failedTsCodes: readonly string[] = [],
): string {
  const reports = uniqueRuns(runs)
  if (!reports.length)
    return ''

  const failed = [...new Set(failedTsCodes)].filter(tsCode => !reports.some(run => run.tsCode === tsCode))
  const summary = [
    `- 成功报告：${reports.length}`,
    `- 失败项目：${failed.length}`,
    ...(failed.length ? [`- 失败股票：${failed.join('、')}`] : []),
  ].join('\n')
  const sections = [
    '# Quant 批量研究报告',
    summary,
    ...reports.map((run, index) => `## 第 ${index + 1} 份研究报告\n\n${withoutReportTitle(buildResearchReportMarkdown(run))}`),
  ]

  return `${sections.join('\n\n---\n\n').trimEnd()}\n`
}

export function buildResearchBatchFilename(runs: readonly QuantResearchRun[]): string {
  const date = runs[0] ? reportDate(runs[0]) : 'unknown-date'
  return `quant-research-batch-${date}.md`
}
