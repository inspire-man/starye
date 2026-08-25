import type { CandidateItem } from './quant-types'

export type CandidateAction = 'complete-data' | 'check-risk' | 'continue-research' | 'observe'
export type CandidateActionTone = 'neutral' | 'warning' | 'positive' | 'info'

export interface CandidateActionMeta {
  action: CandidateAction
  label: string
  detail: string
  tone: CandidateActionTone
}

function riskReasons(item: CandidateItem): string[] {
  const reasons: string[] = []
  if (item.changePercent !== null && item.changePercent <= -3)
    reasons.push('短线回撤')
  if (item.upStreak !== null && item.upStreak >= 5)
    reasons.push('连续上涨')
  if (item.volumeRatio !== null && item.volumeRatio >= 2)
    reasons.push('成交放大')
  return reasons
}

export function getCandidateAction(item: CandidateItem): CandidateActionMeta {
  if (item.pendingSync) {
    return {
      action: 'complete-data',
      label: '待更新数据',
      detail: item.pendingReason || '尚未进入最近一次候选快照，先更新观察池',
      tone: 'neutral',
    }
  }

  if (item.quality !== 'ready') {
    return {
      action: 'complete-data',
      label: '补齐数据',
      detail: '日线字段不足，先更新数据后再比较',
      tone: 'neutral',
    }
  }

  const risks = riskReasons(item)
  if (risks.length) {
    return {
      action: 'check-risk',
      label: '先核对风险',
      detail: `${risks.join('、')}，先核对波动原因`,
      tone: 'warning',
    }
  }

  if ((item.score ?? 0) >= 2) {
    return {
      action: 'continue-research',
      label: '继续研究',
      detail: `命中 ${item.score} 项信号，进入估值和财务核对`,
      tone: 'positive',
    }
  }

  return {
    action: 'observe',
    label: '先观察',
    detail: '信号数量有限，等待更多确认',
    tone: 'info',
  }
}
