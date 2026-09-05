<script setup lang="ts">
import type { QuantFactorDataHealth, QuantFactorDataHealthItem, QuantFactorSourceHealth } from '../../lib/quant-factor-data-health'
import type { QuantFactorFreshness } from '../../lib/quant-view-models'
import { RefreshCw } from 'lucide-vue-next'
import { quantEvidenceLabelForKey, quantEvidenceRefreshActionLabelForKey, quantEvidenceRefreshTargetForKey } from '../../lib/quant-evidence-refresh'

export interface QuantFactorDataHealthProps {
  factorDataHealth: QuantFactorDataHealth | null
  refreshEvidence?: (evidenceKey: string) => void | Promise<void>
  refreshingEvidenceKey?: string | null
  refreshEvidenceErrorMessage?: string | null
  refreshEvidenceMessage?: string | null
}

const {
  factorDataHealth,
  refreshEvidence,
  refreshingEvidenceKey,
  refreshEvidenceErrorMessage,
  refreshEvidenceMessage,
} = defineProps<QuantFactorDataHealthProps>()

function factorHealthStatusLabel(value: QuantFactorDataHealthItem['status']): string {
  return value === 'ready' ? '字段完整' : value === 'partial' ? '部分可用' : value === 'missing' ? '待补数据' : '来源不可用'
}

function factorHealthStatusClass(value: QuantFactorDataHealthItem['status']): string {
  return `quant-factor-health-status-${value}`
}

function factorSourceHealthLabel(value: QuantFactorSourceHealth): string {
  return value === 'primary' ? '主来源' : value === 'fallback' ? '来源需复核' : value === 'unavailable' ? '来源不可用' : '来源状态未知'
}

function factorSourceHealthClass(value: QuantFactorSourceHealth): string {
  return `quant-factor-health-source-${value}`
}

function freshnessForFactor(value: string): QuantFactorFreshness | null {
  return factorDataHealth?.items.find(item => item.factor === value)?.freshness || null
}

function factorFreshnessLabel(value: QuantFactorFreshness | null): string {
  return value?.status === 'fresh' ? '最新' : value?.status === 'aging' ? '需复核' : value?.status === 'stale' ? '已过期' : '时间未知'
}

function factorFreshnessClass(value: QuantFactorFreshness | null): string {
  return `quant-factor-health-freshness-${value?.status || 'unknown'}`
}

function factorObservedAt(value: string | null): string {
  if (!value)
    return '观察时间未记录'
  const compact = value.replace(/-/gu, '').slice(0, 8)
  return /^\d{8}$/u.test(compact) ? `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}` : value.slice(0, 16)
}

function refreshTargetsForFactor(factor: QuantFactorDataHealthItem): { key: string, label: string, actionLabel: string }[] {
  const missingKeys = [...new Set([...factor.missingEvidenceKeys, ...factor.failedEvidenceKeys])]
  const shouldRefreshCurrentEvidence = factor.status === 'unavailable'
    || factor.sourceHealth === 'unavailable'
    || factor.sourceHealth === 'fallback'
    || ['aging', 'stale'].includes(factor.freshness.status)
  const keys = missingKeys.length ? missingKeys : shouldRefreshCurrentEvidence ? factor.evidence.map(item => item.key) : []
  const seen = new Set<string>()
  return keys.flatMap((key) => {
    const target = quantEvidenceRefreshTargetForKey(key)
    const actionLabel = quantEvidenceRefreshActionLabelForKey(key)
    if (!target || !actionLabel || seen.has(target.domain))
      return []
    seen.add(target.domain)
    return [{ key, label: target.label, actionLabel }]
  })
}

function evidenceLabel(factor: QuantFactorDataHealthItem, key: string): string {
  return factor.evidence.find(item => item.key === key)?.label || quantEvidenceLabelForKey(key)
}

function requestEvidenceRefresh(key: string): void {
  if (!refreshEvidence || refreshingEvidenceKey)
    return
  void refreshEvidence(key)
}
</script>

<template>
  <section v-if="factorDataHealth?.items.length" class="quant-factor-data-health" aria-label="因子数据健康">
    <div class="quant-factor-data-health-heading">
      <div>
        <span>因子数据健康</span>
        <strong :class="factorHealthStatusClass(factorDataHealth.status)">{{ factorDataHealth.label }}</strong>
      </div>
      <small>字段覆盖 {{ factorDataHealth.coverage.toFixed(0) }}% · {{ factorDataHealth.readyWeight.toFixed(2) }} / {{ factorDataHealth.totalWeight.toFixed(2) }} 权重已具备</small>
    </div>
    <p class="quant-factor-data-health-note">
      只检查原始字段和来源状态，不代表因子表现或买卖判断。
      <span v-if="factorDataHealth.sourceHealth === 'fallback'">当前至少一个来源使用回退链，需要复核来源时间。</span>
      <span v-else-if="factorDataHealth.sourceHealth === 'unavailable'">当前至少一个来源不可用，需要重试或补充来源。</span>
    </p>
    <div class="quant-factor-data-health-list">
      <div v-for="factor in factorDataHealth.items" :key="factor.factor" class="quant-factor-data-health-row">
        <div class="quant-factor-data-health-row-heading">
          <strong>{{ factor.label }}</strong>
          <span>权重 {{ (factor.weight * 100).toFixed(0) }}%</span>
          <span class="quant-factor-data-health-status" :class="factorHealthStatusClass(factor.status)">{{ factorHealthStatusLabel(factor.status) }}</span>
          <span class="quant-factor-data-health-freshness" :class="factorFreshnessClass(freshnessForFactor(factor.factor))">{{ factorFreshnessLabel(freshnessForFactor(factor.factor)) }}</span>
        </div>
        <div class="quant-factor-data-health-meta">
          <span>证据 {{ factor.usableEvidenceCount }} / {{ factor.evidenceCount }} 可用</span>
          <span>观察 {{ factorObservedAt(factor.observedAt) }}</span>
          <span>时效 {{ freshnessForFactor(factor.factor)?.detail || '没有可核验因子证据时间' }}</span>
          <span :class="factorSourceHealthClass(factor.sourceHealth)">{{ factorSourceHealthLabel(factor.sourceHealth) }}：{{ factor.source || '来源未记录' }}</span>
        </div>
        <div v-if="factor.missingEvidenceKeys.length" class="quant-factor-data-health-gap quant-factor-data-health-missing">
          <span>待补证据：{{ factor.missingEvidenceKeys.map(key => evidenceLabel(factor, key)).join('、') }}</span>
        </div>
        <div v-if="factor.failedEvidenceKeys.length" class="quant-factor-data-health-gap quant-factor-data-health-failed">
          <span>失败证据：{{ factor.failedEvidenceKeys.map(key => evidenceLabel(factor, key)).join('、') }}</span>
        </div>
        <div v-if="refreshEvidence && refreshTargetsForFactor(factor).length" class="quant-factor-data-health-refresh-row">
          <span>数据动作</span>
          <button
            v-for="target in refreshTargetsForFactor(factor)"
            :key="target.label"
            class="text-button quant-factor-data-health-refresh-button"
            type="button"
            :disabled="Boolean(refreshingEvidenceKey)"
            :title="`${target.actionLabel}：${factor.missingEvidenceKeys.concat(factor.failedEvidenceKeys).join('、') || factor.evidence.map(item => item.key).join('、')}`"
            @click="requestEvidenceRefresh(target.key)"
          >
            <RefreshCw :size="12" :class="refreshingEvidenceKey ? 'animate-spin' : ''" aria-hidden="true" />
            {{ refreshingEvidenceKey ? '刷新中' : target.actionLabel }}
          </button>
        </div>
        <small class="quant-factor-data-health-action">下一步：{{ factor.nextAction }}</small>
      </div>
    </div>
    <div v-if="refreshEvidenceMessage" class="quant-factor-data-health-feedback" role="status">
      {{ refreshEvidenceMessage }}
    </div>
    <div v-if="refreshEvidenceErrorMessage" class="quant-factor-data-health-feedback quant-factor-data-health-feedback-error" role="alert">
      {{ refreshEvidenceErrorMessage }}
    </div>
  </section>
</template>

<style scoped>
.quant-factor-data-health {
  display: grid;
  gap: 0.45rem;
  border-top: 1px solid hsl(var(--border));
  padding-top: 0.6rem;
}

.quant-factor-data-health-heading {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.65rem;
}

.quant-factor-data-health-heading > div {
  display: grid;
  min-width: 0;
  gap: 0.15rem;
}

.quant-factor-data-health-heading span,
.quant-factor-data-health-heading small,
.quant-factor-data-health-note,
.quant-factor-data-health-meta,
.quant-factor-data-health-row-heading > span:not(.quant-factor-data-health-status):not(.quant-factor-data-health-freshness),
.quant-factor-data-health-row small {
  overflow-wrap: anywhere;
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
  line-height: 1.45;
}

.quant-factor-data-health-heading strong {
  font-size: 0.8125rem;
}

.quant-factor-health-status-ready { color: hsl(var(--status-success)); }
.quant-factor-health-status-partial { color: hsl(var(--status-warning)); }
.quant-factor-health-status-missing { color: hsl(var(--status-warning)); }
.quant-factor-health-status-unavailable { color: hsl(var(--status-danger)); }

.quant-factor-data-health-note {
  margin: 0;
}

.quant-factor-data-health-list {
  display: grid;
  gap: 0.3rem;
}

.quant-factor-data-health-row {
  display: grid;
  min-width: 0;
  gap: 0.18rem;
  border-left: 2px solid hsl(var(--border));
  padding: 0.25rem 0.45rem;
}

.quant-factor-data-health-row-heading {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 0.65rem;
}

.quant-factor-data-health-row-heading strong {
  min-width: 0;
  overflow-wrap: anywhere;
  color: hsl(var(--foreground));
  font-size: 0.6875rem;
}

.quant-factor-data-health-status {
  margin-left: auto;
  overflow-wrap: anywhere;
  font-size: 0.625rem;
  font-weight: 700;
}

.quant-factor-data-health-freshness {
  flex: 0 0 auto;
  border-radius: var(--ui-radius-sm, 0.25rem);
  padding: 0.12rem 0.3rem;
  font-size: 0.6rem;
  font-weight: 720;
}

.quant-factor-health-freshness-fresh {
  background: hsl(var(--status-success-soft));
  color: hsl(var(--status-success));
}

.quant-factor-health-freshness-aging {
  background: hsl(var(--status-warning-soft));
  color: hsl(var(--status-warning));
}

.quant-factor-health-freshness-stale,
.quant-factor-health-freshness-unknown {
  background: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
}

.quant-factor-data-health-meta {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  gap: 0.25rem 0.85rem;
}

.quant-factor-health-source-primary { color: hsl(var(--muted-foreground)); }
.quant-factor-health-source-fallback { color: hsl(var(--status-warning)); }
.quant-factor-health-source-unavailable { color: hsl(var(--status-danger)); }
.quant-factor-health-source-unknown { color: hsl(var(--muted-foreground)); }

.quant-factor-data-health-gap {
  display: flex;
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: 0.625rem;
  line-height: 1.45;
}

.quant-factor-data-health-missing { color: hsl(var(--status-warning)) !important; }
.quant-factor-data-health-failed { color: hsl(var(--status-danger)) !important; }
.quant-factor-data-health-action { color: hsl(var(--foreground)) !important; }

.quant-factor-data-health-refresh-row {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3rem 0.55rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
}

.quant-factor-data-health-refresh-button {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
}

.quant-factor-data-health-feedback {
  border-left: 2px solid hsl(var(--status-success));
  color: hsl(var(--status-success));
  font-size: 0.625rem;
  line-height: 1.45;
  padding-left: 0.45rem;
}

.quant-factor-data-health-feedback-error {
  border-left-color: hsl(var(--status-danger));
  color: hsl(var(--status-danger));
}

@media (max-width: 520px) {
  .quant-factor-data-health-heading {
    display: grid;
  }

  .quant-factor-data-health-status {
    margin-left: 0;
  }
}
</style>
