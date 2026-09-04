import type { QuantResearchComparison } from './quant-view-models'

function inline(value: string | null | undefined, fallback = '暂无记录'): string {
  const normalized = value?.trim().replace(/\r?\n/gu, ' ')
  return normalized || fallback
}

function list(items: readonly string[]): string {
  return items.length ? items.map(item => `- ${inline(item)}`).join('\n') : '- 暂无记录'
}

function citations(comparison: QuantResearchComparison): string {
  return comparison.citedEvidence.length
    ? comparison.citedEvidence.map(item => `- ${inline(item.tsCode)} · ${inline(item.evidenceKey)}`).join('\n')
    : '- 暂无引用证据'
}

function differences(comparison: QuantResearchComparison): string {
  return comparison.differences.length
    ? comparison.differences.map((item, index) => [
        `### ${index + 1}. ${inline(item.tsCode)}`,
        `- 关键差异：${inline(item.point)}`,
        `- 证据 Key：${item.evidenceKeys.length ? item.evidenceKeys.map(evidenceKey => inline(evidenceKey)).join('、') : '暂无引用证据'}`,
      ].join('\n')).join('\n\n')
    : '- 暂无关键差异'
}

export function buildResearchComparisonMarkdown(comparison: QuantResearchComparison): string {
  const sections = [
    '# Quant AI 对比研究',
    [
      `- 对比版本：${inline(comparison.comparisonVersion)}`,
      `- Provider：${inline(comparison.provider)}`,
      `- 模型：${inline(comparison.model)}`,
      `- 生成时间：${inline(comparison.generatedAt)}`,
    ].join('\n'),
    `## 概览\n\n${inline(comparison.overview)}`,
    `## 共同点\n\n${list(comparison.commonGround)}`,
    `## 关键差异\n\n${differences(comparison)}`,
    `## 风险\n\n${list(comparison.risks)}`,
    `## 下一步核对\n\n${list(comparison.nextChecks)}`,
    `## 引用证据\n\n${citations(comparison)}`,
    '## 口径说明\n\n以上内容来自当前页面已生成的 AI 对比研究，仅用于人工核对；确定性研究报告、候选排序、研究动作和证据数据由系统提供，不代表买入、卖出或收益预测。',
  ]
  return `${sections.join('\n\n').trimEnd()}\n`
}

export function buildResearchComparisonFilename(comparison: QuantResearchComparison): string {
  const date = comparison.generatedAt.match(/^\d{4}-\d{2}-\d{2}/u)?.[0] || 'unknown-date'
  return `quant-research-comparison-${date}.md`
}
