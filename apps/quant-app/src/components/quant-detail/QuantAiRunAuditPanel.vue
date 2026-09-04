<script setup lang="ts">
import type { QuantAiResponseMode, QuantAiRunAudit } from '../../lib/quant-view-models'
import { RefreshCw } from 'lucide-vue-next'

export interface QuantAiRunAuditPanelProps {
  auditRows: QuantAiRunAudit[]
  auditHistoryLoading: boolean
  auditHistoryError: string | null
}

const { auditRows, auditHistoryLoading, auditHistoryError } = defineProps<QuantAiRunAuditPanelProps>()

function auditStatusLabel(value: QuantAiRunAudit['status']): string {
  return value === 'completed' ? '已完成' : value === 'failed' ? '失败' : '已取消'
}

function auditStatusClass(value: QuantAiRunAudit['status']): string {
  return `quant-ai-summary-audit-status-${value}`
}

function auditResponseModeLabel(value: QuantAiResponseMode): string {
  return value === 'stream' ? '流式' : '非流式'
}

function formatImpactTime(value: string | undefined): string {
  if (!value)
    return '时间未记录'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value.slice(0, 16) : parsed.toISOString().replace('T', ' ').slice(0, 16)
}

function formatAuditDuration(value: number): string {
  if (value < 1_000)
    return `${value} 毫秒`
  if (value < 60_000)
    return `${(value / 1_000).toFixed(1)} 秒`
  return `${(value / 60_000).toFixed(1)} 分钟`
}

function formatAuditTimeout(value: number): string {
  return `${(value / 60_000).toFixed(0)} 分钟预算`
}

function formatAuditFailure(audit: QuantAiRunAudit): string {
  return [audit.errorCode, audit.errorMessage].filter(Boolean).join(' · ') || auditStatusLabel(audit.status)
}
</script>

<template>
  <section class="quant-ai-summary-audit" aria-label="AI 运行审计">
    <div class="quant-ai-summary-audit-heading">
      <div>
        <span>AI 运行审计</span>
        <small>记录运行元数据，不保存提示词或模型原文</small>
      </div>
      <small v-if="auditRows.length">最近 {{ auditRows.length }} 次</small>
    </div>
    <div v-if="auditHistoryLoading" class="quant-ai-summary-audit-state" role="status">
      <RefreshCw :size="13" class="animate-spin" aria-hidden="true" />
      <span>正在读取运行记录</span>
    </div>
    <div v-else-if="auditRows.length" class="quant-ai-summary-audit-list">
      <article v-for="audit in auditRows" :key="audit.id" class="quant-ai-summary-audit-row">
        <div class="quant-ai-summary-audit-primary">
          <div>
            <strong :class="auditStatusClass(audit.status)">{{ auditStatusLabel(audit.status) }}</strong>
            <span>{{ audit.model }}</span>
          </div>
          <small>{{ formatImpactTime(audit.completedAt) }}</small>
        </div>
        <div class="quant-ai-summary-audit-meta">
          <span>{{ audit.provider }}</span>
          <span>{{ auditResponseModeLabel(audit.responseMode) }}</span>
          <span>耗时 {{ formatAuditDuration(audit.durationMs) }}</span>
          <span>{{ formatAuditTimeout(audit.generationTimeoutMs) }}</span>
          <span>接收 {{ audit.receivedChars }} 字</span>
        </div>
        <p v-if="audit.status !== 'completed'" class="quant-ai-summary-audit-failure">
          {{ formatAuditFailure(audit) }}
        </p>
      </article>
    </div>
    <p v-else-if="auditHistoryError" class="quant-ai-summary-audit-state quant-ai-summary-audit-state-error" role="status">
      {{ auditHistoryError }}
    </p>
    <p v-else class="quant-ai-summary-audit-state" role="status">
      尚未记录 AI 摘要运行
    </p>
    <p v-if="auditHistoryError && auditRows.length" class="quant-ai-summary-audit-state quant-ai-summary-audit-state-error" role="status">
      {{ auditHistoryError }}
    </p>
  </section>
</template>

<style scoped>
.quant-ai-summary-audit {
  display: grid;
  gap: 0.45rem;
  border-top: 1px solid hsl(var(--border));
  padding-top: 0.65rem;
}

.quant-ai-summary-audit-heading,
.quant-ai-summary-audit-primary,
.quant-ai-summary-audit-primary > div,
.quant-ai-summary-audit-meta {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.45rem;
}

.quant-ai-summary-audit-heading,
.quant-ai-summary-audit-primary {
  justify-content: space-between;
  align-items: flex-start;
}

.quant-ai-summary-audit-heading > div,
.quant-ai-summary-audit-primary > div {
  display: grid;
  min-width: 0;
  gap: 0.15rem;
}

.quant-ai-summary-audit-heading span {
  color: hsl(var(--foreground));
  font-size: 0.6875rem;
  font-weight: 720;
}

.quant-ai-summary-audit-heading small,
.quant-ai-summary-audit-primary small,
.quant-ai-summary-audit-meta,
.quant-ai-summary-audit-state {
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
  line-height: 1.35;
}

.quant-ai-summary-audit-list {
  display: grid;
  gap: 0.35rem;
}

.quant-ai-summary-audit-row {
  display: grid;
  gap: 0.3rem;
  border: 1px solid hsl(var(--border));
  border-radius: var(--ui-radius-sm, 0.25rem);
  background: hsl(var(--muted) / 0.18);
  padding: 0.5rem 0.6rem;
}

.quant-ai-summary-audit-primary strong {
  overflow: hidden;
  color: hsl(var(--foreground));
  font-size: 0.6875rem;
  font-weight: 740;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quant-ai-summary-audit-primary span {
  overflow: hidden;
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quant-ai-summary-audit-meta {
  flex-wrap: wrap;
}

.quant-ai-summary-audit-meta span {
  border-right: 1px solid hsl(var(--border));
  padding-right: 0.45rem;
}

.quant-ai-summary-audit-meta span:last-child {
  border-right: 0;
  padding-right: 0;
}

.quant-ai-summary-audit-status-completed {
  color: hsl(var(--status-success)) !important;
}

.quant-ai-summary-audit-status-failed {
  color: hsl(var(--status-danger)) !important;
}

.quant-ai-summary-audit-status-cancelled {
  color: hsl(var(--status-warning)) !important;
}

.quant-ai-summary-audit-failure,
.quant-ai-summary-audit-state-error {
  margin: 0;
  color: hsl(var(--status-danger));
}

.quant-ai-summary-audit-state {
  display: flex;
  min-height: 1.4rem;
  align-items: center;
  gap: 0.3rem;
  margin: 0;
}
</style>
