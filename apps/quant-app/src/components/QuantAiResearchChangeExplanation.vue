<script setup lang="ts">
import type { QuantResearchChangeExplanation } from '../lib/quant-types'
import type { ResearchEvidenceHistoryComparison } from '../lib/research-evidence-history'
import { AlertCircle, ArrowDown, ArrowUp, BrainCircuit, CircleHelp, Minus, RefreshCw } from 'lucide-vue-next'
import QuantAiProgressStatus from './QuantAiProgressStatus.vue'

const props = defineProps<{
  comparison: ResearchEvidenceHistoryComparison | null
  explanation: QuantResearchChangeExplanation | null
  loading: boolean
  generating: boolean
  errorMessage: string | null
  configurationError: boolean
  questionPromptReady: boolean
}>()

const emit = defineEmits<{
  generate: []
  openSettings: []
  focusEvidence: [evidenceKey: string]
  useNextCheck: [check: string]
}>()

function formatDate(value: string): string {
  if (!value)
    return '时间未记录'
  const date = value.replace(/-/gu, '').slice(0, 8)
  return /^\d{8}$/u.test(date) ? `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}` : value.slice(0, 10)
}

function directionIcon(direction: string) {
  if (direction === 'up')
    return ArrowUp
  if (direction === 'down')
    return ArrowDown
  return direction === 'flat' ? Minus : CircleHelp
}

function changeClass(kind: string): string {
  if (kind === 'improved' || kind === 'restored' || kind === 'added')
    return 'quant-ai-change-item-improved'
  if (kind === 'weakened' || kind === 'newly-missing' || kind === 'removed')
    return 'quant-ai-change-item-weakened'
  return 'quant-ai-change-item-neutral'
}

const isBusy = () => props.loading || props.generating
</script>

<template>
  <section class="quant-ai-change-panel" aria-labelledby="quant-ai-change-title">
    <div class="quant-ai-change-heading">
      <div>
        <p class="section-kicker">
          CHANGE EXPLAINER
        </p>
        <h3 id="quant-ai-change-title">
          AI 解释研究变化
        </h3>
        <small>只解释两次研究快照之间的证据变化，不推断因果或替代研究判断</small>
      </div>
      <button class="secondary-button quant-ai-change-button" type="button" :disabled="isBusy() || !comparison" title="基于两次研究快照解释变化" @click="emit('generate')">
        <RefreshCw v-if="isBusy()" :size="14" class="animate-spin" aria-hidden="true" />
        <BrainCircuit v-else :size="14" aria-hidden="true" />
        {{ isBusy() ? '解释中' : explanation ? '重新解释' : '解释变化' }}
      </button>
    </div>

    <div v-if="!comparison" class="quant-ai-change-state" role="status">
      <CircleHelp :size="15" aria-hidden="true" />
      <span>当前没有可比较的研究快照，至少需要本次和上次报告。</span>
    </div>
    <template v-else>
      <div class="quant-ai-change-comparison" aria-label="研究快照比较范围">
        <span>上次 {{ formatDate(comparison.previousGeneratedAt) }}</span>
        <strong>→</strong>
        <span>本次 {{ formatDate(comparison.currentGeneratedAt) }}</span>
        <small>{{ comparison.changedCount }} 项变化 · {{ comparison.totalEvidenceCount }} 项证据</small>
      </div>

      <div v-if="loading" class="quant-ai-change-state" role="status">
        <RefreshCw :size="15" class="animate-spin" aria-hidden="true" />
        <span>正在读取已保存的变化解释</span>
      </div>
      <QuantAiProgressStatus v-else-if="generating" class="quant-ai-change-state" :active="generating" label="AI 正在整理最值得关注的变化" />
      <div v-else-if="errorMessage" class="quant-ai-change-state quant-ai-change-state-error" role="alert">
        <AlertCircle :size="15" aria-hidden="true" />
        <span>{{ errorMessage }}</span>
        <button v-if="configurationError" class="text-button" type="button" @click="emit('openSettings')">
          打开 AI 配置
        </button>
        <button v-else class="text-button" type="button" @click="emit('generate')">
          重试
        </button>
      </div>
      <template v-else-if="explanation">
        <p class="quant-ai-change-overview">
          {{ explanation.overview }}
        </p>

        <div class="quant-ai-change-list">
          <article v-for="item in explanation.changes" :key="item.evidenceKey" class="quant-ai-change-item" :class="changeClass(item.kind)">
            <div class="quant-ai-change-item-heading">
              <span class="quant-ai-change-kind">
                <component :is="directionIcon(comparison.items.find(change => change.key === item.evidenceKey)?.direction || 'none')" :size="13" aria-hidden="true" />
                {{ item.kindLabel }}
              </span>
              <button class="quant-ai-change-citation" type="button" :aria-label="`回看证据 ${item.label}（${item.evidenceKey}）`" @click="emit('focusEvidence', item.evidenceKey)">
                {{ item.label }}
                <small>{{ item.evidenceKey }}</small>
              </button>
            </div>
            <p>{{ item.explanation }}</p>
          </article>
          <span v-if="!explanation.changes.length" class="quant-ai-change-empty">本次没有返回可解释的变化项。</span>
        </div>

        <div class="quant-ai-change-next">
          <span>下一步核对</span>
          <ul>
            <li v-for="check in explanation.nextChecks" :key="check" class="quant-ai-change-next-item">
              <span class="quant-ai-change-next-text">{{ check }}</span>
              <button
                class="text-button quant-ai-change-next-prompt"
                type="button"
                :disabled="!questionPromptReady || !check.trim()"
                :aria-label="`将变化核对项带入当前追问：${check}`"
                title="将变化核对项转换为当前追问"
                @click="emit('useNextCheck', check)"
              >
                <BrainCircuit :size="13" aria-hidden="true" />
                带入追问
              </button>
            </li>
          </ul>
        </div>

        <div class="quant-ai-change-citations">
          <div class="quant-ai-change-citations-heading">
            <strong>引用 evidence key</strong>
            <small>{{ explanation.citedEvidenceKeys.length }} 条 · {{ explanation.model }} · {{ formatDate(explanation.generatedAt) }}</small>
          </div>
          <div v-if="explanation.citedEvidenceKeys.length" class="quant-ai-change-citation-list">
            <button v-for="key in explanation.citedEvidenceKeys" :key="key" class="quant-ai-change-citation-link" type="button" @click="emit('focusEvidence', key)">
              <span>{{ key }}</span><small>回看证据</small>
            </button>
          </div>
          <span v-else class="quant-ai-change-empty"><CircleHelp :size="13" aria-hidden="true" /> 未返回引用证据</span>
        </div>
      </template>
      <div v-else class="quant-ai-change-state" role="status">
        <CircleHelp :size="15" aria-hidden="true" />
        <span>已找到可比较的快照，按需生成 AI 变化解释。</span>
      </div>
    </template>
  </section>
</template>

<style scoped>
.quant-ai-change-panel { display: grid; gap: .7rem; margin-top: .85rem; border-top: 1px solid hsl(var(--primary) / .28); padding-top: .8rem; min-width: 0; }
.quant-ai-change-heading, .quant-ai-change-item-heading, .quant-ai-change-citations-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: .75rem; min-width: 0; }
.quant-ai-change-heading h3 { margin: .3rem 0 0; color: hsl(var(--foreground)); font-size: .8125rem; font-weight: 740; }
.quant-ai-change-heading small { display: block; margin-top: .2rem; color: hsl(var(--muted-foreground)); font-size: .625rem; line-height: 1.4; }
.quant-ai-change-button { flex: 0 0 auto; }
.quant-ai-change-state { display: flex; min-height: 2.75rem; align-items: center; justify-content: center; gap: .4rem; color: hsl(var(--muted-foreground)); font-size: .6875rem; text-align: center; }
.quant-ai-change-state-error { justify-content: flex-start; flex-wrap: wrap; color: hsl(var(--status-danger)); }
.quant-ai-change-comparison { display: flex; flex-wrap: wrap; align-items: center; gap: .35rem; border: 1px solid hsl(var(--border)); border-radius: var(--ui-radius-sm, .25rem); background: hsl(var(--muted) / .28); padding: .45rem .55rem; color: hsl(var(--foreground)); font-size: .6875rem; }
.quant-ai-change-comparison small { flex-basis: 100%; color: hsl(var(--muted-foreground)); font-size: .625rem; }
.quant-ai-change-overview { margin: 0; color: hsl(var(--foreground)); font-size: .75rem; line-height: 1.55; overflow-wrap: anywhere; }
.quant-ai-change-list { display: grid; gap: .45rem; min-width: 0; }
.quant-ai-change-item { display: grid; gap: .3rem; min-width: 0; border: 1px solid hsl(var(--border)); border-left: 2px solid hsl(var(--status-info) / .65); border-radius: var(--ui-radius-sm, .25rem); padding: .45rem .5rem; }
.quant-ai-change-item-improved { border-left-color: hsl(var(--status-success) / .75); background: hsl(var(--status-success) / .06); }
.quant-ai-change-item-weakened { border-left-color: hsl(var(--status-warning) / .8); background: hsl(var(--status-warning) / .06); }
.quant-ai-change-kind { display: inline-flex; flex: 0 0 auto; align-items: center; gap: .25rem; color: hsl(var(--muted-foreground)); font-size: .625rem; font-weight: 720; }
.quant-ai-change-item-improved .quant-ai-change-kind { color: hsl(var(--status-success)); }
.quant-ai-change-item-weakened .quant-ai-change-kind { color: hsl(var(--status-warning)); }
.quant-ai-change-citation, .quant-ai-change-citation-link { min-width: 0; border: 0; background: transparent; padding: 0; color: hsl(var(--foreground)); text-align: left; cursor: pointer; }
.quant-ai-change-citation { overflow: hidden; font-size: .6875rem; font-weight: 720; text-overflow: ellipsis; white-space: nowrap; }
.quant-ai-change-citation small, .quant-ai-change-citation-link small { display: block; color: hsl(var(--muted-foreground)); font-size: .59375rem; font-weight: 400; overflow-wrap: anywhere; }
.quant-ai-change-item p { margin: 0; color: hsl(var(--muted-foreground)); font-size: .6875rem; line-height: 1.45; overflow-wrap: anywhere; }
.quant-ai-change-next, .quant-ai-change-citations { display: grid; gap: .4rem; border-top: 1px solid hsl(var(--border)); padding-top: .6rem; }
.quant-ai-change-next > span, .quant-ai-change-citations-heading strong { color: hsl(var(--muted-foreground)); font-size: .625rem; font-weight: 700; }
.quant-ai-change-next ul { display: grid; gap: .25rem; margin: 0; padding-left: .95rem; color: hsl(var(--foreground)); font-size: .6875rem; line-height: 1.45; }
.quant-ai-change-next-item { display: grid; min-width: 0; grid-template-columns: minmax(0, 1fr) auto; align-items: start; gap: .35rem; }
.quant-ai-change-next-text { min-width: 0; overflow-wrap: anywhere; }
.quant-ai-change-next-prompt { display: inline-flex; flex: 0 0 auto; align-items: center; gap: .2rem; white-space: nowrap; }
.quant-ai-change-next-prompt:hover:not(:disabled) { text-decoration: underline; }
.quant-ai-change-next-prompt:disabled { cursor: not-allowed; opacity: .55; }
.quant-ai-change-citations-heading small { color: hsl(var(--muted-foreground)); font-size: .625rem; text-align: right; overflow-wrap: anywhere; }
.quant-ai-change-citation-list { display: flex; flex-wrap: wrap; gap: .4rem; min-width: 0; }
.quant-ai-change-citation-link { display: inline-flex; max-width: 100%; flex-direction: column; gap: .1rem; border: 1px solid hsl(var(--status-success) / .25); border-radius: var(--ui-radius-sm, .25rem); background: hsl(var(--status-success) / .06); padding: .35rem .45rem; }
.quant-ai-change-citation-link span { max-width: 100%; color: hsl(var(--foreground)); font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: .625rem; overflow-wrap: anywhere; }
.quant-ai-change-citation-link small { color: hsl(var(--status-success)); }
.quant-ai-change-empty { display: inline-flex; align-items: center; gap: .25rem; color: hsl(var(--muted-foreground)); font-size: .625rem; }
button:focus-visible { outline: 2px solid hsl(var(--ring)); outline-offset: 2px; }
@media (max-width: 680px) { .quant-ai-change-heading { flex-direction: column; } .quant-ai-change-button { width: 100%; } .quant-ai-change-item-heading { flex-direction: column; gap: .25rem; } .quant-ai-change-citation { white-space: normal; overflow-wrap: anywhere; } .quant-ai-change-next-item { grid-template-columns: minmax(0, 1fr); } .quant-ai-change-next-prompt { justify-self: start; } .quant-ai-change-citations-heading { flex-direction: column; gap: .25rem; } .quant-ai-change-citations-heading small { text-align: left; } }
</style>
