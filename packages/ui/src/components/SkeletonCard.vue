<script setup lang="ts">
interface Props {
  variant?: 'stat' | 'content' | 'image'
}

withDefaults(defineProps<Props>(), {
  variant: 'content',
})
</script>

<template>
  <div class="rounded-lg border border-border p-6">
    <!-- Stat 变体 -->
    <div v-if="variant === 'stat'" class="space-y-3">
      <div class="flex items-center justify-between">
        <div class="skeleton-shimmer h-8 w-8 rounded-lg" />
        <div class="skeleton-shimmer h-6 w-16 rounded" />
      </div>
      <div class="skeleton-shimmer h-10 w-24 rounded" />
      <div class="skeleton-shimmer h-4 w-32 rounded" />
    </div>

    <!-- Content 变体 -->
    <div v-else-if="variant === 'content'" class="space-y-3">
      <div class="skeleton-shimmer h-6 w-3/4 rounded" />
      <div class="space-y-2">
        <div class="skeleton-shimmer h-4 w-full rounded" />
        <div class="skeleton-shimmer h-4 w-full rounded" />
        <div class="skeleton-shimmer h-4 w-2/3 rounded" />
      </div>
    </div>

    <!-- Image 变体 -->
    <div v-else-if="variant === 'image'" class="space-y-4">
      <div class="skeleton-shimmer aspect-video w-full rounded-lg" />
      <div class="space-y-2">
        <div class="skeleton-shimmer h-5 w-3/4 rounded" />
        <div class="skeleton-shimmer h-4 w-full rounded" />
        <div class="skeleton-shimmer h-4 w-5/6 rounded" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.skeleton-shimmer {
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
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-shimmer {
    animation: pulse 2s infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
}
</style>
