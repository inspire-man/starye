<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'

// Props 定义
interface Props {
  modelValue: boolean
  direction?: 'ltr' | 'rtl'
  size?: string | number
  modal?: boolean
  modalClass?: string
  closeOnClickModal?: boolean
  closeOnPressEscape?: boolean
  lockScroll?: boolean
  beforeClose?: (done: () => void) => void
  showClose?: boolean
  withHeader?: boolean
  title?: string
  zIndex?: number
  customClass?: string
}

const props = withDefaults(defineProps<Props>(), {
  direction: 'ltr',
  size: '80vw',
  modal: true,
  closeOnClickModal: true,
  closeOnPressEscape: true,
  lockScroll: true,
  showClose: true,
  withHeader: true,
  title: '',
  zIndex: 2000,
  customClass: '',
})

// Emits 定义
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'open': []
  'opened': []
  'close': []
  'closed': []
}>()

// 方法
function handleClose() {
  if (props.beforeClose) {
    props.beforeClose(() => {
      emit('update:modelValue', false)
      emit('close')
    })
  }
  else {
    emit('update:modelValue', false)
    emit('close')
  }
}

function handleModalClick() {
  if (props.closeOnClickModal) {
    handleClose()
  }
}

function handleEscape(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.closeOnPressEscape && props.modelValue) {
    handleClose()
  }
}

function getScrollbarWidth() {
  const scrollDiv = document.createElement('div')
  scrollDiv.style.cssText = 'width: 99px; height: 99px; overflow: scroll; position: absolute; top: -9999px;'
  document.body.appendChild(scrollDiv)
  const scrollbarWidth = scrollDiv.offsetWidth - scrollDiv.clientWidth
  document.body.removeChild(scrollDiv)
  return scrollbarWidth
}

// 监听模态框状态
watch(() => props.modelValue, (val, oldVal) => {
  if (val && !oldVal) {
    emit('open')
    setTimeout(emit, 300, 'opened')

    if (props.lockScroll) {
      const scrollbarWidth = getScrollbarWidth()
      document.body.style.overflow = 'hidden'
      document.body.style.paddingRight = `${scrollbarWidth}px`
    }
  }
  else if (!val && oldVal) {
    emit('closed')

    if (props.lockScroll) {
      document.body.style.overflow = ''
      document.body.style.paddingRight = ''
    }
  }
})

// 生命周期
onMounted(() => {
  if (props.closeOnPressEscape) {
    document.addEventListener('keydown', handleEscape)
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscape)

  // 清理滚动锁定
  if (props.modelValue && props.lockScroll) {
    document.body.style.overflow = ''
    document.body.style.paddingRight = ''
  }
})

// 计算样式
const drawerSize = typeof props.size === 'number' ? `${props.size}px` : props.size
const maxWidth = props.size === '80vw' ? '320px' : 'none'
</script>

<template>
  <Teleport to="body">
    <!-- 遮罩层 -->
    <Transition name="drawer-fade">
      <div
        v-if="modelValue && modal"
        class="drawer-modal"
        :class="modalClass"
        :style="{ zIndex: zIndex - 1 }"
        @click="handleModalClick"
      />
    </Transition>

    <!-- 抽屉主体 -->
    <Transition :name="`drawer-${direction}`">
      <div
        v-if="modelValue"
        class="drawer-wrapper"
        :class="[customClass, `drawer-${direction}`]"
        :style="{
          zIndex,
          width: drawerSize,
          maxWidth,
          [direction === 'ltr' ? 'left' : 'right']: 0,
        }"
      >
        <!-- 头部 -->
        <header v-if="withHeader" class="drawer-header">
          <slot name="header">
            <span class="drawer-title">{{ title }}</span>
          </slot>
          <button
            v-if="showClose"
            class="drawer-close"
            aria-label="Close drawer"
            @click="handleClose"
          >
            ✕
          </button>
        </header>

        <!-- 内容 -->
        <div class="drawer-body">
          <slot />
        </div>

        <!-- 底部 -->
        <footer v-if="$slots.footer" class="drawer-footer">
          <slot name="footer" />
        </footer>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* 遮罩层 */
.drawer-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
}

.drawer-fade-enter-active,
.drawer-fade-leave-active {
  transition: opacity 0.3s ease;
}

.drawer-fade-enter-from,
.drawer-fade-leave-to {
  opacity: 0;
}

/* 抽屉主体 */
.drawer-wrapper {
  position: fixed;
  top: 0;
  bottom: 0;
  background: rgb(31, 41, 55);
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  overflow: hidden;
}

/* 从左侧滑入 */
.drawer-ltr-enter-active,
.drawer-ltr-leave-active {
  transition: transform 0.3s cubic-bezier(0.23, 1, 0.32, 1);
}

.drawer-ltr-enter-from,
.drawer-ltr-leave-to {
  transform: translateX(-100%);
}

/* 从右侧滑入 */
.drawer-rtl-enter-active,
.drawer-rtl-leave-active {
  transition: transform 0.3s cubic-bezier(0.23, 1, 0.32, 1);
}

.drawer-rtl-enter-from,
.drawer-rtl-leave-to {
  transform: translateX(100%);
}

/* 头部 */
.drawer-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid rgb(55, 65, 81);
}

.drawer-title {
  font-size: 18px;
  font-weight: 600;
  color: white;
}

.drawer-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: rgb(156, 163, 175);
  font-size: 20px;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
}

.drawer-close:hover {
  background: rgb(55, 65, 81);
  color: white;
}

/* 内容 */
.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.drawer-body::-webkit-scrollbar {
  width: 6px;
}

.drawer-body::-webkit-scrollbar-track {
  background: transparent;
}

.drawer-body::-webkit-scrollbar-thumb {
  background: rgb(75, 85, 99);
  border-radius: 3px;
}

.drawer-body::-webkit-scrollbar-thumb:hover {
  background: rgb(107, 114, 128);
}

/* 底部 */
.drawer-footer {
  flex-shrink: 0;
  border-top: 1px solid rgb(55, 65, 81);
}
</style>
