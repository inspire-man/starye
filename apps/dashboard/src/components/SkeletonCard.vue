<script setup lang="ts">
/**
 * 卡片骨架屏组件
 *
 * @component
 * @description
 * 用于在卡片内容加载时显示占位骨架，支持三种变体：
 * - stat: 统计卡片（图标 + 数字 + 描述）
 * - content: 内容卡片（标题 + 多行文字）
 * - image: 图片卡片（图片 + 文字描述）
 *
 * @example 统计卡片骨架
 * ```vue
 * <template>
 *   <SkeletonCard
 *     v-if="loading"
 *     variant="stat"
 *   />
 * </template>
 * ```
 *
 * @example 内容卡片骨架
 * ```vue
 * <template>
 *   <SkeletonCard
 *     v-if="loading"
 *     variant="content"
 *   />
 * </template>
 * ```
 *
 * @example 图片卡片骨架
 * ```vue
 * <template>
 *   <SkeletonCard
 *     v-if="loading"
 *     variant="image"
 *   />
 * </template>
 * ```
 */
interface Props {
  /** 卡片变体类型，默认 'content' */
  variant?: 'stat' | 'content' | 'image'
}

withDefaults(defineProps<Props>(), {
  variant: 'content',
})
</script>

<template>
  <div class="border rounded-lg p-6">
    <!-- Stat 变体：图标 + 大号数字 + 描述 -->
    <div v-if="variant === 'stat'" class="space-y-3">
      <div class="flex items-center justify-between">
        <div class="skeleton-base w-8 h-8 rounded-lg" />
        <div class="skeleton-base w-16 h-6 rounded" />
      </div>
      <div class="skeleton-base w-24 h-10 rounded" />
      <div class="skeleton-base w-32 h-4 rounded" />
    </div>

    <!-- Content 变体：标题 + 多行内容 -->
    <div v-else-if="variant === 'content'" class="space-y-3">
      <div class="skeleton-base w-3/4 h-6 rounded" />
      <div class="space-y-2">
        <div class="skeleton-base w-full h-4 rounded" />
        <div class="skeleton-base w-full h-4 rounded" />
        <div class="skeleton-base w-2/3 h-4 rounded" />
      </div>
    </div>

    <!-- Image 变体：图片占位 + 文字 -->
    <div v-else-if="variant === 'image'" class="space-y-4">
      <div class="skeleton-base w-full aspect-video rounded-lg" />
      <div class="space-y-2">
        <div class="skeleton-base w-3/4 h-5 rounded" />
        <div class="skeleton-base w-full h-4 rounded" />
        <div class="skeleton-base w-5/6 h-4 rounded" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.skeleton-base {
  background: linear-gradient(
    90deg,
    hsl(var(--muted)) 0%,
    hsl(var(--muted-foreground) / 0.1) 50%,
    hsl(var(--muted)) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-base {
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
}
</style>
