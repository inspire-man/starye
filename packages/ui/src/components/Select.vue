<script setup lang="ts" generic="T = string">
import type { SelectOption } from '../types/select'
import { Check, ChevronDown, LoaderCircle, X } from 'lucide-vue-next'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

interface Props {
  modelValue: T
  options: SelectOption<T>[]
  placeholder?: string
  size?: 'small' | 'default' | 'large'
  disabled?: boolean
  clearable?: boolean
  teleportTo?: string
  placement?: 'top' | 'bottom'
  popperClass?: string
  loading?: boolean
  error?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '请选择',
  size: 'default',
  disabled: false,
  clearable: false,
  teleportTo: 'body',
  placement: 'bottom',
  loading: false,
  error: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: T]
  'change': [value: T]
  'visibleChange': [visible: boolean]
  'clear': []
  'blur': []
  'focus': []
}>()

const selectRef = ref<HTMLDivElement | null>(null)
const dropdownRef = ref<HTMLDivElement | null>(null)
const visible = ref(false)
const dropdownStyle = ref<Record<string, string>>({})

const selectedOption = computed(() => props.options.find(option => option.value === props.modelValue))
const selectedLabel = computed(() => selectedOption.value?.label ?? '')

function calculatePosition() {
  if (!selectRef.value || !dropdownRef.value)
    return

  const rect = selectRef.value.getBoundingClientRect()
  const height = dropdownRef.value.offsetHeight
  const shouldPlaceTop = props.placement === 'top'
    || (props.placement === 'bottom' && window.innerHeight - rect.bottom < height && rect.top > height)

  dropdownStyle.value = {
    position: 'fixed',
    top: `${shouldPlaceTop ? rect.top - height - 4 : rect.bottom + 4}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    zIndex: '4000',
  }
}

function toggleDropdown() {
  if (props.disabled || props.loading)
    return
  visible.value = !visible.value
}

function selectOption(option: SelectOption<T>) {
  if (option.disabled)
    return
  emit('update:modelValue', option.value)
  emit('change', option.value)
  visible.value = false
}

function clearValue(event: MouseEvent) {
  event.stopPropagation()
  emit('update:modelValue', undefined as T)
  emit('clear')
  visible.value = false
}

function handleClickOutside(event: MouseEvent) {
  const target = event.target as Node
  if (selectRef.value?.contains(target) || dropdownRef.value?.contains(target))
    return
  visible.value = false
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && visible.value) {
    visible.value = false
    emit('blur')
  }
  if ((event.key === 'Enter' || event.key === ' ') && document.activeElement === selectRef.value) {
    event.preventDefault()
    toggleDropdown()
  }
}

watch(visible, async (isVisible) => {
  emit('visibleChange', isVisible)
  if (isVisible) {
    document.addEventListener('click', handleClickOutside)
    document.addEventListener('keydown', handleKeydown)
    emit('focus')
    await nextTick()
    calculatePosition()
  }
  else {
    document.removeEventListener('click', handleClickOutside)
    document.removeEventListener('keydown', handleKeydown)
    emit('blur')
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div
    ref="selectRef"
    class="custom-select"
    :class="[
      `custom-select--${size}`,
      {
        'is-disabled': disabled,
        'is-focus': visible,
        'is-error': error,
        'is-loading': loading,
      },
    ]"
    role="combobox"
    tabindex="0"
    :aria-expanded="visible"
    :aria-disabled="disabled"
    @click="toggleDropdown"
  >
    <div class="select-input">
      <span class="select-value" :class="{ 'is-placeholder': !selectedLabel }">
        <span v-if="selectedOption?.icon" class="select-value-icon">{{ selectedOption.icon }}</span>
        {{ selectedLabel || placeholder }}
      </span>

      <span class="select-suffix">
        <button
          v-if="clearable && modelValue !== undefined && modelValue !== null && !disabled"
          type="button"
          class="select-clear"
          aria-label="清除选择"
          @click="clearValue"
        >
          <X :size="12" aria-hidden="true" />
        </button>
        <LoaderCircle v-else-if="loading" class="select-loading" :size="15" aria-hidden="true" />
        <ChevronDown v-else class="select-arrow" :class="{ 'is-reverse': visible }" :size="16" aria-hidden="true" />
      </span>
    </div>

    <Teleport :to="teleportTo">
      <Transition name="select-dropdown">
        <div v-show="visible" ref="dropdownRef" class="select-dropdown" :class="popperClass" :style="dropdownStyle">
          <div class="select-dropdown__list" role="listbox">
            <button
              v-for="option in options"
              :key="String(option.value)"
              type="button"
              class="select-option"
              :class="{ 'is-selected': option.value === modelValue, 'is-disabled': option.disabled }"
              :disabled="option.disabled"
              role="option"
              :aria-selected="option.value === modelValue"
              @click.stop="selectOption(option)"
            >
              <span v-if="option.icon" class="option-icon">{{ option.icon }}</span>
              <span class="option-copy">
                <span class="option-label">{{ option.label }}</span>
                <span v-if="option.description" class="option-desc">{{ option.description }}</span>
              </span>
              <Check v-if="option.value === modelValue" class="option-check" :size="15" aria-hidden="true" />
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.custom-select {
  position: relative;
  display: inline-block;
  width: 100%;
  min-width: 0;
  color: hsl(var(--foreground));
}

.custom-select.is-disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.select-input {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2, 0.5rem);
  min-width: 0;
  height: var(--ui-control-height-md, 2.25rem);
  padding: 0 var(--ui-space-3, 0.75rem);
  border: 1px solid hsl(var(--input));
  border-radius: var(--ui-radius-md, 0.375rem);
  background: hsl(var(--background) / 0.72);
  color: hsl(var(--foreground));
  cursor: pointer;
  transition: border-color 150ms ease, box-shadow 150ms ease, background-color 150ms ease;
}

.custom-select--small .select-input {
  height: var(--ui-control-height-sm, 2rem);
  padding-inline: 0.625rem;
  font-size: 0.8125rem;
}

.custom-select--large .select-input {
  height: var(--ui-control-height-lg, 2.5rem);
  padding-inline: 0.875rem;
}

.select-input:hover,
.custom-select.is-focus .select-input {
  border-color: hsl(var(--primary) / 0.72);
  background: hsl(var(--background));
}

.custom-select.is-focus .select-input {
  box-shadow: 0 0 0 3px hsl(var(--ring) / 0.14);
}

.custom-select.is-error .select-input {
  border-color: hsl(var(--destructive));
}

.select-value {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: var(--ui-space-2, 0.5rem);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.select-value.is-placeholder {
  color: hsl(var(--muted-foreground));
}

.select-value-icon,
.option-icon {
  flex: 0 0 auto;
}

.select-suffix {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  color: hsl(var(--muted-foreground));
}

.select-clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  border: 0;
  border-radius: 999px;
  background: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
}

.select-clear:hover {
  background: hsl(var(--destructive) / 0.12);
  color: hsl(var(--destructive));
}

.select-loading {
  animation: select-spin 0.9s linear infinite;
}

.select-arrow {
  transition: transform 150ms ease;
}

.select-arrow.is-reverse {
  transform: rotate(180deg);
}

.select-dropdown {
  max-height: min(18rem, 45vh);
  overflow: auto;
  border: 1px solid hsl(var(--border));
  border-radius: var(--ui-radius-lg, 0.5rem);
  background: hsl(var(--popover));
  box-shadow: var(--ui-surface-shadow);
}

.select-dropdown__list {
  display: grid;
  gap: 0.125rem;
  padding: 0.25rem;
}

.select-option {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  gap: var(--ui-space-2, 0.5rem);
  padding: 0.5rem 0.625rem;
  border: 0;
  border-radius: var(--ui-radius-md, 0.375rem);
  background: transparent;
  color: hsl(var(--popover-foreground));
  text-align: left;
  cursor: pointer;
  transition: background-color 150ms ease, color 150ms ease;
}

.select-option:hover:not(:disabled),
.select-option.is-selected {
  background: hsl(var(--accent));
  color: hsl(var(--accent-foreground));
}

.select-option.is-selected {
  color: hsl(var(--primary));
  font-weight: 600;
}

.select-option:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.option-copy {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 0.125rem;
}

.option-label,
.option-desc {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.option-desc {
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
  font-weight: 400;
}

.option-check {
  flex: 0 0 auto;
}

.select-dropdown-enter-active,
.select-dropdown-leave-active {
  transition: opacity 150ms ease, transform 150ms ease;
}

.select-dropdown-enter-from,
.select-dropdown-leave-to {
  opacity: 0;
  transform: translateY(-0.25rem);
}

@keyframes select-spin {
  to { transform: rotate(360deg); }
}
</style>
