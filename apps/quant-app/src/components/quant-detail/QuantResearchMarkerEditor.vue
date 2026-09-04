<script setup lang="ts">
import type { ResearchMarkerStatus } from '../../lib/quant-view-models'
import { Save } from 'lucide-vue-next'

export interface QuantResearchMarkerEditorProps {
  researchStatusOptions: { value: ResearchMarkerStatus, label: string }[]
  researchSaving: boolean
  researchSaveMessage: string
  researchSaveErrorMessage: string | null
  saveResearchMarker: () => void | Promise<void>
}

const {
  researchStatusOptions,
  researchSaving,
  researchSaveMessage,
  researchSaveErrorMessage,
  saveResearchMarker,
} = defineProps<QuantResearchMarkerEditorProps>()

const researchFormStatus = defineModel<ResearchMarkerStatus>('researchFormStatus', { required: true })
const researchFormNote = defineModel<string>('researchFormNote', { required: true })
const researchFormReviewDate = defineModel<string>('researchFormReviewDate', { required: true })
</script>

<template>
  <section class="research-marker-editor" aria-label="研究记录">
    <div class="research-marker-heading">
      <div>
        <p class="section-kicker">
          RESEARCH LOG
        </p>
        <h2>我的研究记录</h2>
      </div>
      <span class="section-meta">只保存你的工作状态，不影响信号分</span>
    </div>
    <div class="research-marker-form">
      <label class="research-field">
        <span>状态</span>
        <select v-model="researchFormStatus" class="field-control">
          <option v-for="option in researchStatusOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
        </select>
      </label>
      <label class="research-field research-field-date">
        <span>复查日期</span>
        <input v-model="researchFormReviewDate" class="field-control" type="date">
      </label>
      <label class="research-field research-field-note">
        <span>备注</span>
        <textarea v-model="researchFormNote" class="field-control research-note-input" maxlength="1000" placeholder="记录需要核对的事项、假设或下一步动作" />
      </label>
      <button class="primary-button research-save-button" type="button" :disabled="researchSaving" @click="saveResearchMarker">
        <Save :size="15" aria-hidden="true" />
        {{ researchSaving ? '保存中' : '保存记录' }}
      </button>
    </div>
    <p v-if="researchSaveMessage" class="research-save-message" role="status">
      {{ researchSaveMessage }}
    </p>
    <p v-if="researchSaveErrorMessage" class="research-save-error" role="alert">
      {{ researchSaveErrorMessage }}
    </p>
  </section>
</template>
