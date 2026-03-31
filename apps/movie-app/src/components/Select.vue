<script setup lang="ts" generic="T = any">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

// 类型定义
export interface SelectOption<T = any> {
  label: string
  value: T
  disabled?: boolean
  icon?: string
  description?: string
}

// Props 定义
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

// Emits 定义
const emit = defineEmits<{
  'update:modelValue': [value: T]
  'change': [value: T]
  'visibleChange': [visible: boolean]
  'clear': []
  'blur': []
  'focus': []
}>()

// 响应式状态
const selectRef = ref<HTMLDivElement>()
const dropdownRef = ref<HTMLDivElement>()
const visible = ref(false)
const dropdownStyle = ref<Record<string, string>>({})

// 计算属性
const selectedOption = computed(() => {
  return props.options.find(opt => opt.value === props.modelValue)
})

const selectedLabel = computed(() => {
  return selectedOption.value?.label || ''
})

const sizeClass = computed(() => {
  return `custom-select--${props.size}`
})

// 方法
function toggleDropdown() {
  if (props.disabled || props.loading)
    return
  visible.value = !visible.value
}

function handleSelect(option: SelectOption<T>) {
  if (option.disabled)
    return

  emit('update:modelValue', option.value)
  emit('change', option.value)
  visible.value = false
}

function handleClear(e: Event) {
  e.stopPropagation()
  emit('update:modelValue', undefined as T)
  emit('clear')
  visible.value = false
}

function calculatePosition() {
  if (!selectRef.value || !dropdownRef.value)
    return

  const rect = selectRef.value.getBoundingClientRect()
  const dropdownHeight = dropdownRef.value.offsetHeight
  const spaceBelow = window.innerHeight - rect.bottom
  const spaceAbove = rect.top

  // 自动判断放置位置
  let placement = props.placement
  if (placement === 'bottom' && spaceBelow < dropdownHeight && spaceAbove > dropdownHeight) {
    placement = 'top'
  }

  dropdownStyle.value = {
    position: 'fixed',
    top: placement === 'top'
      ? `${rect.top - dropdownHeight - 4}px`
      : `${rect.bottom + 4}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    zIndex: '2001',
  }
}

function handleClickOutside(event: MouseEvent) {
  const target = event.target as Node
  if (
    selectRef.value && !selectRef.value.contains(target)
    && dropdownRef.value && !dropdownRef.value.contains(target)
  ) {
    visible.value = false
  }
}

function handleEscape(e: KeyboardEvent) {
  if (e.key === 'Escape' && visible.value) {
    visible.value = false
    emit('blur')
  }
}

// 生命周期
watch(visible, (val) => {
  emit('visibleChange', val)

  if (val) {
    setTimeout(calculatePosition, 10)
    document.addEventListener('click', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    emit('focus')
  }
  else {
    document.removeEventListener('click', handleClickOutside)
    document.removeEventListener('keydown', handleEscape)
    emit('blur')
  }
})

onMounted(() => {
  if (visible.value) {
    document.addEventListener('click', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
  }
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleEscape)
})
</script>

<template>
  <div
    ref="selectRef"
    class="custom-select"
    :class="[
      sizeClass,
      {
        'is-disabled': disabled,
        'is-focus': visible,
        'is-error': error,
        'is-loading': loading,
      },
    ]"
    @click="toggleDropdown"
  >
    <!-- 输入框区域 -->
    <div class="select-input">
      <!-- 显示内容 -->
      <span
        class="select-value"
        :class="{ 'is-placeholder': !selectedLabel }"
      >
        <span v-if="selectedOption?.icon" class="select-value-icon">
          {{ selectedOption.icon }}
        </span>
        {{ selectedLabel || placeholder }}
      </span>

      <!-- 后缀图标 -->
      <span class="select-suffix">
        <span
          v-if="clearable && modelValue !== undefined && modelValue !== null && !disabled"
          class="select-clear"
          @click.stop="handleClear"
        >
          ✕
        </span>
        <span
          v-else-if="loading"
          class="select-loading"
        >
          ⟳
        </span>
        <span
          v-else
          class="select-arrow"
          :class="{ 'is-reverse': visible }"
        >
          ▼
        </span>
      </span>
    </div>

    <!-- 下拉面板 -->
    <Teleport :to="teleportTo">
      <Transition name="select-dropdown">
        <div
          v-show="visible"
          ref="dropdownRef"
          class="select-dropdown"
          :class="popperClass"
          :style="dropdownStyle"
        >
          <!-- 选项列表 -->
          <div class="select-dropdown__list">
            <div
              v-for="option in options"
              :key="String(option.value)"
              class="select-option"
              :class="{
                'is-selected': option.value === modelValue,
                'is-disabled': option.disabled,
              }"
              @click="handleSelect(option)"
            >
              <span v-if="option.icon" class="option-icon">
                {{ option.icon }}
              </span>
              <span class="option-label">
                {{ option.label }}
              </span>
              <span v-if="option.description" class="option-desc">
                {{ option.description }}
              </span>
              <span v-if="option.value === modelValue" class="option-check">
                ✓
              </span>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
/* 基础样式 */
.custom-select {
  position: relative;
  display: inline-block;
  width: 100%;
  cursor: pointer;
}

.custom-select.is-disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

/* 尺寸变体 */
.custom-select--small .select-input {
  height: 32px;
  font-size: 13px;
  padding: 0 10px;
}

.custom-select--default .select-input {
  height: 40px;
  font-size: 14px;
  padding: 0 12px;
}

.custom-select--large .select-input {
  height: 48px;
  font-size: 16px;
  padding: 0 14px;
}

/* 输入框 */
.select-input {
  display: flex;
  align-items: center;
  background: rgb(31, 41, 55);
  border: 1px solid rgb(55, 65, 81);
  border-radius: 8px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  color: white;
}

.select-input:hover:not(.is-disabled) {
  border-color: rgb(75, 85, 99);
}

.custom-select.is-focus .select-input {
  border-color: rgb(59, 130, 246);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.custom-select.is-error .select-input {
  border-color: rgb(239, 68, 68);
}

/* 值显示 */
.select-value {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 6px;
}

.select-value.is-placeholder {
  color: rgb(156, 163, 175);
}

.select-value-icon {
  font-size: 16px;
  flex-shrink: 0;
}

/* 后缀 */
.select-suffix {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: 8px;
  flex-shrink: 0;
}

.select-clear {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: rgb(55, 65, 81);
  font-size: 10px;
  opacity: 0;
  transition: opacity 0.2s, background 0.2s;
}

.custom-select:hover .select-clear {
  opacity: 1;
}

.select-clear:hover {
  background: rgb(75, 85, 99);
}

.select-loading {
  font-size: 14px;
  animation: rotate 1s linear infinite;
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.select-arrow {
  display: inline-block;
  font-size: 10px;
  transition: transform 0.3s;
  color: rgb(156, 163, 175);
}

.select-arrow.is-reverse {
  transform: rotate(180deg);
}

/* 下拉面板 */
.select-dropdown {
  position: fixed;
  background: rgb(31, 41, 55);
  border: 1px solid rgb(55, 65, 81);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  margin-top: 4px;
  min-width: 120px;
  max-height: 274px;
  overflow: auto;
}

.select-dropdown__list {
  padding: 4px;
}

/* 选项 */
.select-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
  color: rgb(229, 231, 235);
}

.select-option:hover:not(.is-disabled) {
  background: rgb(55, 65, 81);
}

.select-option.is-selected {
  color: rgb(59, 130, 246);
  font-weight: 500;
}

.select-option.is-disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.option-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.option-label {
  flex: 1;
}

.option-desc {
  font-size: 12px;
  color: rgb(156, 163, 175);
}

.option-check {
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
}

/* 动画 */
.select-dropdown-enter-active,
.select-dropdown-leave-active {
  transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1),
              transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.select-dropdown-enter-from {
  opacity: 0;
  transform: scaleY(0.9) translateY(-4px);
}

.select-dropdown-leave-to {
  opacity: 0;
  transform: scaleY(0.9) translateY(4px);
}

/* 滚动条样式 */
.select-dropdown::-webkit-scrollbar {
  width: 6px;
}

.select-dropdown::-webkit-scrollbar-track {
  background: transparent;
}

.select-dropdown::-webkit-scrollbar-thumb {
  background: rgb(75, 85, 99);
  border-radius: 3px;
}

.select-dropdown::-webkit-scrollbar-thumb:hover {
  background: rgb(107, 114, 128);
}
</style>
