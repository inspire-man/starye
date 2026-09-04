<script setup lang="ts">
import type { QuantDecisionRecordAction } from '../../lib/quant-view-models'
import type { QuantDecisionJournalFormProps, QuantDecisionJournalSaveInput } from './quant-journal-contracts'
import { Save } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'

const props = defineProps<QuantDecisionJournalFormProps>()

const emit = defineEmits<{
  save: [input: QuantDecisionJournalSaveInput]
}>()

const actionOptions: readonly { value: QuantDecisionRecordAction, label: string, description: string }[] = [
  { value: 'watch', label: '继续观察', description: '暂不改变计划' },
  { value: 'plan-buy', label: '计划买入', description: '等待价格或条件' },
  { value: 'holding', label: '已持有', description: '记录当前持仓判断' },
  { value: 'sold', label: '已卖出', description: '保留退出后的复盘' },
]

const formAction = ref<QuantDecisionRecordAction>('watch')
const formNote = ref('')
const formNoteLength = computed(() => formNote.value.length)

function submit(): void {
  if (props.saving || !props.run)
    return
  emit('save', { action: formAction.value, note: formNote.value.trim() || null })
}

watch(
  () => [props.run?.id || null, props.record?.id || null, props.record?.updatedAt || null] as const,
  () => {
    if (props.record && props.record.researchRunId === props.run?.id) {
      formAction.value = props.record.action
      formNote.value = props.record.note || ''
      return
    }
    formAction.value = 'watch'
    formNote.value = ''
  },
  { immediate: true },
)
</script>

<template>
  <form v-if="run" class="quant-decision-form" @submit.prevent="submit">
    <fieldset>
      <legend>这次判断</legend>
      <div class="quant-decision-action-options" role="radiogroup" aria-label="选择决策动作">
        <label v-for="option in actionOptions" :key="option.value" class="quant-decision-action-option" :class="{ 'quant-decision-action-option-selected': formAction === option.value }">
          <input v-model="formAction" type="radio" name="quant-decision-action" :value="option.value" :aria-label="option.label">
          <span>
            <strong>{{ option.label }}</strong>
            <small>{{ option.description }}</small>
          </span>
        </label>
      </div>
    </fieldset>
    <label class="quant-decision-note-field">
      <span>备注 <small>可记录触发条件、价格依据或复查事项</small></span>
      <textarea v-model="formNote" class="field-control quant-decision-note-input" maxlength="500" placeholder="写下你此刻的判断依据" />
    </label>
    <div class="quant-decision-form-footer">
      <span>{{ formNoteLength }} / 500</span>
      <button class="primary-button quant-decision-save-button" type="submit" :disabled="saving">
        <Save :size="15" aria-hidden="true" />
        {{ saving ? '保存中' : record ? '更新决策记录' : '保存决策记录' }}
      </button>
    </div>
  </form>
</template>

<style scoped>
.quant-decision-form {
  display: grid;
  min-width: 0;
  gap: 0.65rem;
  border-top: 1px solid hsl(var(--border));
  padding-top: 0.7rem;
}

.quant-decision-form fieldset {
  min-width: 0;
  margin: 0;
  border: 0;
  padding: 0;
}

.quant-decision-form legend,
.quant-decision-note-field > span {
  margin-bottom: 0.45rem;
  color: hsl(var(--foreground));
  font-size: 0.75rem;
  font-weight: 720;
}

.quant-decision-action-options {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.4rem;
}

.quant-decision-action-option {
  display: grid;
  min-width: 0;
  cursor: pointer;
  border: 1px solid hsl(var(--border));
  border-radius: var(--ui-radius-sm, 0.25rem);
  background: hsl(var(--card));
  padding: 0.5rem;
  transition: border-color 150ms ease, background-color 150ms ease;
}

.quant-decision-action-option:focus-within {
  border-color: hsl(var(--ring));
  box-shadow: 0 0 0 3px hsl(var(--ring) / 0.13);
}

.quant-decision-action-option-selected {
  border-color: hsl(var(--primary) / 0.55);
  background: hsl(var(--accent) / 0.6);
}

.quant-decision-action-option input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.quant-decision-action-option span {
  display: grid;
  min-width: 0;
  gap: 0.15rem;
}

.quant-decision-action-option strong {
  overflow-wrap: anywhere;
  color: hsl(var(--foreground));
  font-size: 0.75rem;
  line-height: 1.35;
}

.quant-decision-action-option small,
.quant-decision-note-field small,
.quant-decision-form-footer {
  overflow-wrap: anywhere;
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
  line-height: 1.4;
}

.quant-decision-note-field {
  display: grid;
  min-width: 0;
}

.quant-decision-note-field > span {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.35rem;
}

.quant-decision-note-input {
  width: 100%;
  min-height: 4.5rem;
  height: auto;
  resize: vertical;
  padding-top: 0.55rem;
  padding-bottom: 0.55rem;
}

.quant-decision-form-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.quant-decision-save-button {
  flex: 0 0 auto;
}

@media (max-width: 680px) {
  .quant-decision-action-options {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .quant-decision-form-footer {
    align-items: stretch;
    flex-direction: column;
  }

  .quant-decision-save-button {
    width: 100%;
  }
}
</style>
