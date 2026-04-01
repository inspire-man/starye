<script setup lang="ts">
interface Props {
  fields?: number
  hasTextarea?: boolean
  hasButtons?: boolean
}

withDefaults(defineProps<Props>(), {
  fields: 4,
  hasTextarea: false,
  hasButtons: true,
})
</script>

<template>
  <div class="space-y-6">
    <!-- 普通字段 -->
    <div
      v-for="i in fields"
      :key="i"
      class="space-y-2"
    >
      <div class="skeleton-base w-24 h-4 rounded" />
      <div class="skeleton-base w-full h-10 rounded" />
    </div>

    <!-- Textarea 字段 -->
    <div v-if="hasTextarea" class="space-y-2">
      <div class="skeleton-base w-32 h-4 rounded" />
      <div class="skeleton-base w-full h-32 rounded" />
    </div>

    <!-- 底部按钮 -->
    <div v-if="hasButtons" class="flex items-center gap-3 pt-4">
      <div class="skeleton-base w-20 h-10 rounded" />
      <div class="skeleton-base w-20 h-10 rounded" />
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
