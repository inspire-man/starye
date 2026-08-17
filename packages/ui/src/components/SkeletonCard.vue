<script setup lang="ts">
interface Props {
  variant?: 'stat' | 'content' | 'image' | 'poster' | 'row'
}

withDefaults(defineProps<Props>(), {
  variant: 'content',
})
</script>

<template>
  <div class="skeleton-card rounded-lg border border-border" :class="`skeleton-card-${variant}`" role="status" aria-label="加载中">
    <!-- Stat 变体 -->
    <div v-if="variant === 'stat'" class="space-y-3">
      <div class="flex items-center justify-between">
        <div class="skeleton-shimmer h-4 w-20 rounded" />
        <div class="skeleton-shimmer h-8 w-8 rounded-full" />
      </div>
      <div class="skeleton-shimmer h-8 w-24 rounded" />
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
    <div v-else-if="variant === 'image'" class="space-y-3">
      <div class="skeleton-shimmer aspect-video w-full rounded-[var(--ui-radius-lg)]" />
      <div class="space-y-2">
        <div class="skeleton-shimmer h-5 w-3/4 rounded" />
        <div class="skeleton-shimmer h-3.5 w-2/3 rounded" />
      </div>
    </div>

    <!-- Poster 变体 -->
    <div v-else-if="variant === 'poster'" class="space-y-3">
      <div class="skeleton-shimmer aspect-[3/4] w-full rounded-[var(--ui-radius-lg)]" />
      <div class="space-y-2">
        <div class="skeleton-shimmer h-5 w-3/4 rounded" />
        <div class="skeleton-shimmer h-3.5 w-2/3 rounded" />
      </div>
    </div>

    <!-- Row 变体 -->
    <div v-else-if="variant === 'row'" class="flex min-h-24 items-center gap-3">
      <div class="skeleton-shimmer h-16 w-12 shrink-0 rounded-md" />
      <div class="min-w-0 flex-1 space-y-2">
        <div class="skeleton-shimmer h-4 w-3/4 rounded" />
        <div class="skeleton-shimmer h-3.5 w-full rounded" />
        <div class="skeleton-shimmer h-3.5 w-1/2 rounded" />
      </div>
      <div class="skeleton-shimmer h-8 w-20 shrink-0 rounded-md" />
    </div>
  </div>
</template>

<style scoped>
.skeleton-card {
  background: hsl(var(--card));
  box-shadow: 0 1px 2px hsl(var(--foreground) / 0.04);
}

.skeleton-card-stat {
  min-height: 8.75rem;
  border-radius: var(--ui-radius-lg, 0.5rem);
  padding: 1rem 1.125rem;
}

.skeleton-card-content {
  padding: 1rem 1.125rem;
}

.skeleton-card-image {
  padding: 1rem 1.125rem;
}

.skeleton-card-poster {
  padding: 0.25rem;
  border-color: transparent;
  background: transparent;
  box-shadow: none;
}

.skeleton-card-row {
  padding: 0.75rem;
}

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
