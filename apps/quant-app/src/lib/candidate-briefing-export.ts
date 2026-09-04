import type { QuantAiCandidateBriefing, QuantAiCandidateBriefingFocusItem, QuantAiCandidateBriefingSession } from './quant-view-models'

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

function buildCandidateAiBriefingSections(
  briefing: QuantAiCandidateBriefing,
  candidateCount: number,
  headingPrefix = '##',
): string[] {
  const boundedCandidateCount = Number.isFinite(candidateCount) ? Math.max(0, Math.floor(candidateCount)) : 0
  const focusItems = briefing.focusItems.length
    ? briefing.focusItems.map(focusItem).join('\n\n')
    : '- 未返回重点候选'
  const citedCandidateCodes = list(briefing.citedCandidateCodes)
  const sections = [
    [
      `- 简报版本：${inline(briefing.briefingVersion)}`,
      `- Provider：${inline(briefing.provider)}`,
      `- 模型：${inline(briefing.model)}`,
      `- 生成时间：${inline(briefing.generatedAt, '未记录')}`,
      `- 当前候选：${boundedCandidateCount} 个`,
    ].join('\n'),
    `${headingPrefix} 整体概览\n\n${inline(briefing.overview)}`,
    `${headingPrefix} 重点候选\n\n${focusItems}`,
    `${headingPrefix} 下一步核对\n\n${list(briefing.nextChecks)}`,
    `${headingPrefix} 引用候选代码\n\n${citedCandidateCodes}`,
  ]
  return sections
}

function sessionDateRange(session: QuantAiCandidateBriefingSession): string {
  if (session.fromDate && session.toDate)
    return `${inline(session.fromDate)} ~ ${inline(session.toDate)}`
  return inline(session.fromDate || session.toDate, '未记录')
}

function questionItem(question: QuantAiCandidateBriefingSession['questions'][number], index: number): string {
  return [
    `### ${index + 1}. ${inline(question.question, '问题未记录')}`,
    `- 版本：${inline(question.questionVersion)}`,
    `- Provider：${inline(question.provider)}`,
    `- 模型：${inline(question.model)}`,
    `- 生成时间：${inline(question.generatedAt, '未记录')}`,
    `- 回答：${inline(question.answer)}`,
    '- 引用候选代码：',
    list(question.citedCandidateCodes),
  ].join('\n')
}

function sessionFileDate(session: QuantAiCandidateBriefingSession): string {
  return [session.snapshotGeneratedAt, session.updatedAt, session.createdAt]
    .find((value): value is string => Boolean(value && /^\d{4}-\d{2}-\d{2}/u.test(value)))
    ?.slice(0, 10) || 'unknown-date'
}

function sessionFileId(session: QuantAiCandidateBriefingSession): string {
  return session.id.trim().replace(/[^\w-]/gu, '-').replace(/-+/gu, '-').slice(0, 32) || 'unknown-session'
}

export function buildCandidateAiBriefingMarkdown(briefing: QuantAiCandidateBriefing, candidateCount: number): string {
  const sections = [
    '# Quant AI 候选简报',
    ...buildCandidateAiBriefingSections(briefing, candidateCount),
    '## 口径说明\n\n以上内容来自当前页面已生成的候选简报，仅用于人工研究核对；确定性优先级、分数、研究动作和候选数据由系统提供，不代表买入、卖出或收益预测。',
  ]
  return `${sections.join('\n\n').trimEnd()}\n`
}

export function buildCandidateAiSessionMarkdown(session: QuantAiCandidateBriefingSession): string {
  const briefing = session.briefing
    ? [
        '### 简报元数据',
        ...buildCandidateAiBriefingSections(session.briefing, session.candidateCodes.length, '###'),
      ].join('\n\n')
    : '- 未保存历史简报'
  const questions = session.questions.length
    ? session.questions.map(questionItem).join('\n\n')
    : '- 未保存历史追问'
  const sections = [
    '# Quant AI 候选历史会话',
    [
      `- 会话 ID：${inline(session.id)}`,
      `- 快照 ID：${inline(session.snapshotId)}`,
      `- 快照时间：${inline(session.snapshotGeneratedAt, '未记录')}`,
      `- 日期范围：${sessionDateRange(session)}`,
      `- scopeKey：${inline(session.scopeKey)}`,
      `- Provider：${inline(session.provider)}`,
      `- 模型：${inline(session.model)}`,
      `- 创建时间：${inline(session.createdAt, '未记录')}`,
      `- 更新时间：${inline(session.updatedAt, '未记录')}`,
    ].join('\n'),
    `## 历史候选代码\n\n${list(session.candidateCodes)}`,
    `## 历史简报\n\n${briefing}`,
    `## 历史追问\n\n${questions}`,
    '## 口径说明\n\n以上内容来自已保存的候选 AI 历史会话，仅用于人工研究核对；历史内容不会改变当前候选排序、分数、研究动作或确定性数据。',
  ]
  return `${sections.join('\n\n').trimEnd()}\n`
}

export function buildCandidateAiBriefingFilename(briefing: QuantAiCandidateBriefing): string {
  const date = briefing.generatedAt.match(/^\d{4}-\d{2}-\d{2}/u)?.[0] || 'unknown-date'
  return `quant-candidate-briefing-${date}.md`
}

export function buildCandidateAiSessionFilename(session: QuantAiCandidateBriefingSession): string {
  return `quant-candidate-ai-session-${sessionFileDate(session)}-${sessionFileId(session)}.md`
}
