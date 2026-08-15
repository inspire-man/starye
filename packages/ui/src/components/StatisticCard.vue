<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

interface Props {
  label: string
  value: number
  description?: string
  prefix?: string
  suffix?: string
  tone?: 'primary' | 'info' | 'success' | 'warning' | 'danger' | 'neutral'
  clickable?: boolean
  duration?: number
}

const props = withDefaults(defineProps<Props>(), {
  description: '',
  prefix: '',
  suffix: '',
  tone: 'primary',
  clickable: false,
  duration: 520,
})

const emit = defineEmits<{
  click: []
}>()

const displayedValue = ref(0)
let animationFrame = 0

const formattedValue = computed(() => new Intl.NumberFormat('zh-CN').format(Math.round(displayedValue.value)))

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

function animateTo(targetValue: number): void {
  const target = Number.isFinite(targetValue) ? targetValue : 0
  const start = displayedValue.value

  if (animationFrame)
    cancelAnimationFrame(animationFrame)

  if (prefersReducedMotion() || props.duration <= 0 || start === target) {
    displayedValue.value = target
    return
  }

  const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now()
  const tick = (now: number) => {
    const elapsed = now - startedAt
    const progress = Math.min(elapsed / props.duration, 1)
    const eased = 1 - ((1 - progress) ** 3)
    displayedValue.value = start + ((target - start) * eased)

    if (progress < 1)
      animationFrame = requestAnimationFrame(tick)
    else
      animationFrame = 0
  }

  animationFrame = requestAnimationFrame(tick)
}

function handleKeydown(event: KeyboardEvent): void {
  if (!props.clickable || (event.key !== 'Enter' && event.key !== ' '))
    return
  event.preventDefault()
  emit('click')
}

watch(() => props.value, animateTo, { immediate: true })

onBeforeUnmount(() => {
  if (animationFrame)
    cancelAnimationFrame(animationFrame)
})
</script>

<template>
  <article
    class="ui-statistic-card"
    :class="[`ui-statistic-card-${tone}`, { 'ui-statistic-card-clickable': clickable }]"
    :role="clickable ? 'button' : undefined"
    :tabindex="clickable ? 0 : undefined"
    @click="clickable && emit('click')"
    @keydown="handleKeydown"
  >
    <div class="ui-statistic-card-heading">
      <span class="ui-statistic-card-label">{{ label }}</span>
      <span class="ui-statistic-card-icon" aria-hidden="true">
        <slot name="icon" />
      </span>
    </div>
    <div class="ui-statistic-card-value" aria-live="polite">
      {{ prefix }}{{ formattedValue }}{{ suffix }}
    </div>
    <p v-if="description || $slots.description" class="ui-statistic-card-description">
      <slot name="description">
        {{ description }}
      </slot>
    </p>
  </article>
</template>

<style scoped>
.ui-statistic-card {
  position: relative;
  display: grid;
  min-height: 8.75rem;
  align-content: space-between;
  gap: 0.75rem;
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: var(--ui-radius-lg, 0.5rem);
  background: hsl(var(--card));
  padding: 1rem 1.125rem;
  box-shadow: 0 1px 2px hsl(var(--foreground) / 0.04);
  transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
}

.ui-statistic-card::before {
  position: absolute;
  inset: 0 auto 0 0;
  width: 0.2rem;
  background: hsl(var(--statistic-accent));
  content: '';
}

.ui-statistic-card-clickable {
  cursor: pointer;
}

.ui-statistic-card-clickable:hover,
.ui-statistic-card-clickable:focus-visible {
  border-color: hsl(var(--statistic-accent) / 0.45);
  box-shadow: 0 10px 24px hsl(var(--foreground) / 0.08);
  outline: none;
  transform: translateY(-1px);
}

.ui-statistic-card-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.ui-statistic-card-label {
  color: hsl(var(--muted-foreground));
  font-size: 0.8125rem;
  font-weight: 600;
}

.ui-statistic-card-icon {
  display: inline-flex;
  height: 2rem;
  width: 2rem;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background: hsl(var(--statistic-accent) / 0.1);
  color: hsl(var(--statistic-accent));
}

.ui-statistic-card-value {
  color: hsl(var(--foreground));
  font-size: 1.875rem;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1;
}

.ui-statistic-card-description {
  margin: 0;
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
  line-height: 1.25rem;
}

.ui-statistic-card-primary { --statistic-accent: var(--primary); }
.ui-statistic-card-info { --statistic-accent: var(--status-info); }
.ui-statistic-card-success { --statistic-accent: var(--status-success); }
.ui-statistic-card-warning { --statistic-accent: var(--status-warning); }
.ui-statistic-card-danger { --statistic-accent: var(--status-danger); }
.ui-statistic-card-neutral { --statistic-accent: var(--status-neutral); }
</style>
