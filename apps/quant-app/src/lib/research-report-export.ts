import type { QuantResearchRun, QuantResearchSummary } from './quant-types'

const REPORT_STATUS_LABELS: Record<string, string> = {
  ready: '证据完整',
  partial: '部分可用',
  insufficient_data: '数据不足',
}

const ACTION_LABELS: Record<string, string> = {
  'research-window': '继续研究',
  'wait-confirmation': '等待确认',
  'reassess': '重新评估',
  'complete-data': '数据补齐后再看',
}

const EVIDENCE_STATUS_LABELS: Record<string, string> = {
  pass: '通过',
  caution: '谨慎',
  fail: '未通过',
  missing: '缺失',
}

function inline(value: string | null | undefined, fallback = '暂无数据'): string {
  const normalized = value?.trim().replace(/\r?\n/g, ' ')
  return normalized || fallback
}

function list(items: readonly string[]): string {
  return items.length ? items.map(item => `- ${inline(item)}`).join('\n') : '- 暂无记录'
}

function numberValue(value: number | null): string {
  return value !== null && Number.isFinite(value) ? String(value) : '暂无数据'
}

export function buildResearchReportMarkdown(run: QuantResearchRun, aiSummary: QuantResearchSummary | null = null): string {
  const report = run.report
  const evidence = report.evidence.length
    ? report.evidence.flatMap((item, index) => [
        `### ${index + 1}. ${inline(item.label, '未命名证据')}`,
        `- Key：${inline(item.key)}`,
        `- 维度：${inline(item.dimension)}`,
        `- 状态：${EVIDENCE_STATUS_LABELS[item.status] || inline(item.status)}`,
        `- 原始值：${numberValue(item.value)}`,
        `- 阈值：${inline(item.threshold)}`,
        `- 来源：${inline(item.source)}`,
        `- 观察时间：${inline(item.observedAt, '未记录')}`,
        `- 公式版本：${inline(item.formulaVersion)}`,
        `- 说明：${inline(item.detail)}`,
        ...(item.optional ? ['- 类型：可选证据'] : []),
      ]).join('\n')
    : '- 暂无证据'
  const sources = report.sources.length
    ? report.sources.map(source => `- ${inline(source.name)} · 观察时间 ${inline(source.observedAt, '未记录')} · 公式版本 ${inline(source.formulaVersion)}`).join('\n')
    : '- 暂无来源快照'
  const sections = [
    '# Quant 研究报告',
    [
      `- 股票：${inline(report.name, '名称待补齐')}（${inline(report.tsCode, '代码未知')}）`,
      `- 报告版本：${inline(report.reportVersion)}`,
      `- 生成时间：${inline(report.generatedAt, '未记录')}`,
      `- 来源快照：${inline(report.sourceSnapshotId)}`,
      `- 当前状态：${REPORT_STATUS_LABELS[report.status] || inline(report.status)}`,
      `- 研究动作：${ACTION_LABELS[report.action] || inline(report.action)}`,
      `- 研究分数：${numberValue(report.score)}`,
    ].join('\n'),
    `## 结论\n\n${inline(report.headline)}`,
    `## 支持依据\n\n${list(report.strengths)}`,
    `## 风险核对\n\n${list(report.risks)}`,
    `## 数据缺口\n\n${list(report.gaps)}`,
    `## 下一步\n\n${list(report.nextActions)}`,
    `## 证据链\n\n${evidence}`,
    `## 来源快照\n\n${sources}`,
  ]

  if (aiSummary) {
    sections.push([
      '## AI 摘要',
      `- 摘要版本：${inline(aiSummary.summaryVersion)}`,
      '',
      '### 概览',
      inline(aiSummary.summary.overview),
      '',
      '### 支持点',
      list(aiSummary.summary.supports),
      '',
      '### 关注点',
      list(aiSummary.summary.concerns),
      '',
      '### 下一步核对',
      list(aiSummary.summary.nextChecks),
      '',
      '### 引用证据 Key',
      list(aiSummary.citedEvidenceKeys),
    ].join('\n'))
  }

  sections.push('## 口径说明\n\n以上内容来自当前已保存的研究快照和可选 AI 摘要；导出文件用于人工复核，不代表买入、卖出或收益预测。')
  return `${sections.join('\n\n').trimEnd()}\n`
}

function filenamePart(value: string, fallback: string): string {
  const normalized = value.trim().replace(/[^\w.-]+/g, '-')
  return normalized.replace(/^-+|-+$/g, '') || fallback
}

export function buildResearchReportFilename(run: QuantResearchRun): string {
  const dateMatch = (run.generatedAt || run.report.generatedAt).match(/^\d{4}-\d{2}-\d{2}/)
  const date = dateMatch?.[0] || 'unknown-date'
  return `quant-research-${filenamePart(run.tsCode, 'unknown-stock')}-${date}.md`
}
