<script setup lang="ts">
import { onMounted, ref } from 'vue'

const props = withDefaults(defineProps<{
  label: string
  open?: boolean
}>(), {
  open: false,
})

const details = ref<HTMLDetailsElement | null>(null)

onMounted(() => {
  if (details.value && props.open)
    details.value.open = true
})
</script>

<template>
  <details ref="details" class="quant-report-fold quant-report-fold-section">
    <summary>
      <span>{{ label }}</span>
    </summary>
    <div class="quant-report-fold-body">
      <slot />
    </div>
  </details>
</template>
