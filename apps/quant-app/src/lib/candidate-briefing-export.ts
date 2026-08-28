import type { QuantAiCandidateBriefing, QuantAiCandidateBriefingFocusItem } from './quant-types'

function inline(value: string | null | undefined, fallback = '暂无数据'): string {
  const normalized = value?.trim().replace(/\r?\n/gu, ' ')
  return normalized || fallback
}

function list(items: readonly string[], fallback = '- 暂无记录'): string {
  return items.length ? items.map(item => `- ${inline(item)}`).join('\n') : fallback
}

function priorityLabel(level: QuantAiCandidateBriefingFocusItem['priorityLevel']): string {
  return {
    urgent: '紧急',
    high: '高优先',
    normal: '常规',
    low: '低优先',
  }[level]
}

function score(value: number): string {
  return Number.isFinite(value) ? value.toFixed(1) : '暂无数据'
}

function focusItem(item: QuantAiCandidateBriefingFocusItem, index: number): string {
  const name = inline(item.name, '名称待补齐')
  return [
    `### ${index + 1}. ${name}（${inline(item.tsCode, '代码未知')}）`,
    `- 优先级：${priorityLabel(item.priorityLevel)}（${inline(item.priorityLevel)}）`,
    `- 优先级分数：${score(item.priorityScore)}`,
    `- 研究动作：${inline(item.actionLabel)}`,
    '- 触发原因：',
    list(item.reasons),
    `- AI 核对说明：${inline(item.explanation)}`,
  ].join('\n')
}

export function buildCandidateAiBriefingMarkdown(briefing: QuantAiCandidateBriefing, candidateCount: number): string {
  const boundedCandidateCount = Number.isFinite(candidateCount) ? Math.max(0, Math.floor(candidateCount)) : 0
  const focusItems = briefing.focusItems.length
    ? briefing.focusItems.map(focusItem).join('\n\n')
    : '- 未返回重点候选'
  const citedCandidateCodes = list(briefing.citedCandidateCodes)
  const sections = [
    '# Quant AI 候选简报',
    [
      `- 简报版本：${inline(briefing.briefingVersion)}`,
      `- Provider：${inline(briefing.provider)}`,
      `- 模型：${inline(briefing.model)}`,
      `- 生成时间：${inline(briefing.generatedAt, '未记录')}`,
      `- 当前候选：${boundedCandidateCount} 个`,
    ].join('\n'),
    `## 整体概览\n\n${inline(briefing.overview)}`,
    `## 重点候选\n\n${focusItems}`,
    `## 下一步核对\n\n${list(briefing.nextChecks)}`,
    `## 引用候选代码\n\n${citedCandidateCodes}`,
    '## 口径说明\n\n以上内容来自当前页面已生成的候选简报，仅用于人工研究核对；确定性优先级、分数、研究动作和候选数据由系统提供，不代表买入、卖出或收益预测。',
  ]
  return `${sections.join('\n\n').trimEnd()}\n`
}

export function buildCandidateAiBriefingFilename(briefing: QuantAiCandidateBriefing): string {
  const date = briefing.generatedAt.match(/^\d{4}-\d{2}-\d{2}/u)?.[0] || 'unknown-date'
  return `quant-candidate-briefing-${date}.md`
}
