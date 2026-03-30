<script setup lang="ts">
import { computed, ref } from 'vue'

interface Props {
  modelValue?: number // 当前评分（1-5）
  interactive?: boolean // 是否可交互
  showStats?: boolean // 是否显示统计信息
  count?: number // 评分人数
  size?: 'small' | 'medium' | 'large' // 尺寸
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: 0,
  interactive: false,
  showStats: false,
  size: 'medium',
})

const emit = defineEmits<{
  'update:modelValue': [value: number]
  'change': [value: number]
}>()

const hoverValue = ref<number>(0)

// 显示的评分值（悬停时显示悬停值，否则显示当前值）
const displayValue = computed(() => {
  if (props.interactive && hoverValue.value > 0) {
    return hoverValue.value
  }
  return props.modelValue
})

/**
 * 格式化评分人数（如 1234 -> 1.2k）
 */
function formatCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`
  }
  return count.toString()
}

/**
 * 计算星星的裁剪路径（支持半星）
 */
function getClipPath(starIndex: number): string {
  const value = displayValue.value
  if (value >= starIndex) {
    return 'inset(0 0 0 0)' // 完全显示
  }
  else if (value >= starIndex - 0.5) {
    return 'inset(0 50% 0 0)' // 半星
  }
  else {
    return 'inset(0 100% 0 0)' // 不显示
  }
}

/**
 * 鼠标悬停
 */
function handleMouseEnter(index: number) {
  if (!props.interactive)
    return
  hoverValue.value = index
}

/**
 * 鼠标离开
 */
function handleMouseLeave() {
  if (!props.interactive)
    return
  hoverValue.value = 0
}

/**
 * 点击星星
 */
function handleClick(index: number) {
  if (!props.interactive)
    return

  emit('update:modelValue', index)
  emit('change', index)
}

/**
 * 触摸开始（移动端）
 */
function handleTouchStart(index: number) {
  if (!props.interactive)
    return

  hoverValue.value = index

  // 延迟触发点击，防止误触
  setTimeout(() => {
    if (hoverValue.value === index) {
      handleClick(index)
    }
  }, 100)
}
</script>

<template>
  <div class="rating-stars">
    <!-- 星星显示区 -->
    <div class="stars-container" @mouseleave="handleMouseLeave">
      <div
        v-for="index in 5"
        :key="index"
        class="star-wrapper"
        :class="{ disabled: !interactive }"
        @mouseenter="() => handleMouseEnter(index)"
        @click="() => handleClick(index)"
        @touchstart="() => handleTouchStart(index)"
      >
        <!-- 背景空星 -->
        <svg
          class="star-icon empty"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            stroke="currentColor"
            stroke-width="2"
            fill="none"
          />
        </svg>

        <!-- 前景满星 -->
        <svg
          class="star-icon filled"
          :style="{ clipPath: getClipPath(index) }"
          viewBox="0 0 24 24"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
          />
        </svg>
      </div>
    </div>

    <!-- 评分数值和人数 -->
    <div v-if="showStats" class="rating-stats">
      <span class="rating-value">{{ displayValue.toFixed(1) }}</span>
      <span v-if="count !== undefined" class="rating-count">({{ formatCount(count) }})</span>
    </div>
  </div>
</template>

<style scoped>
.rating-stars {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.stars-container {
  display: flex;
  gap: 4px;
}

.star-wrapper {
  position: relative;
  cursor: pointer;
  transition: transform 0.2s;
}

.star-wrapper:not(.disabled):hover {
  transform: scale(1.1);
}

.star-wrapper.disabled {
  cursor: default;
}

.star-icon {
  width: 24px;
  height: 24px;
  transition: color 0.2s;
}

.star-icon.empty {
  color: #ddd;
}

.star-icon.filled {
  position: absolute;
  top: 0;
  left: 0;
  color: #ffc107;
}

/* 尺寸变体 */
.rating-stars.small .star-icon {
  width: 16px;
  height: 16px;
}

.rating-stars.large .star-icon {
  width: 32px;
  height: 32px;
}

/* 评分统计 */
.rating-stats {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
}

.rating-value {
  font-weight: 600;
  color: #333;
}

.rating-count {
  color: #999;
}

/* 深色模式适配 */
@media (prefers-color-scheme: dark) {
  .star-icon.empty {
    color: #444;
  }

  .rating-value {
    color: #eee;
  }

  .rating-count {
    color: #888;
  }
}

/* 移动端适配 */
@media (max-width: 768px) {
  .stars-container {
    gap: 2px;
  }

  .star-icon {
    width: 20px;
    height: 20px;
  }
}
</style>
