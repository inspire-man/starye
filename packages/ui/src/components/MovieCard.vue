<script setup lang="ts">
interface Props {
  title: string
  href: string
  code: string
  cover?: string | null
  releaseDate?: Date | null
  isR18?: boolean
  actors?: string[] | null
  genres?: string[] | null
  layout?: 'grid' | 'list'
  // i18n 文本传入
  labelAdultOnly?: string
  labelMissingCover?: string
}

withDefaults(defineProps<Props>(), {
  labelAdultOnly: 'R18',
  labelMissingCover: 'No Cover',
  layout: 'grid',
})

function formatDate(date?: Date | null) {
  if (!date)
    return ''
  return new Date(date).toLocaleDateString('zh-CN')
}
</script>

<template>
  <RouterLink
    :to="href"
    :data-layout="layout"
    :aria-label="`${code} ${title}`"
    class="movie-card group block min-w-0 cursor-pointer text-left"
  >
    <div class="movie-card-poster relative overflow-hidden rounded-[var(--ui-radius-lg)] border border-border bg-muted shadow-sm transition-all duration-300 group-hover:-translate-y-0.5 group-hover:border-primary/55 group-hover:shadow-md">
      <img
        v-if="cover"
        :src="cover"
        :alt="title"
        loading="lazy"
        class="movie-card-image h-full w-full object-cover object-right transition-transform duration-500 group-hover:scale-105"
      >

      <!-- Placeholder / R18 Mask -->
      <div v-else class="flex h-full w-full flex-col items-center justify-center bg-muted p-4 text-center">
        <span class="mb-2 text-3xl">{{ isR18 ? '🔞' : '🖼️' }}</span>
        <span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{{ isR18 ? labelAdultOnly : labelMissingCover }}</span>
      </div>

      <div class="movie-card-code absolute right-2 top-2 rounded border border-white/20 bg-black/60 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-white backdrop-blur">
        {{ code }}
      </div>

      <div v-if="isR18 && cover" class="ui-status-tag ui-status-danger absolute left-2 top-2 border-white/30 bg-black/55 text-white backdrop-blur">
        R18
      </div>

      <div class="movie-card-overlay absolute inset-x-0 bottom-0 flex translate-y-2 items-center justify-between gap-2 bg-black/72 px-3 py-2 text-xs font-semibold text-white opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
        <span>查看详情</span>
        <span aria-hidden="true">↗</span>
      </div>
    </div>

    <div class="movie-card-body min-w-0">
      <div class="mt-3 flex min-w-0 items-start justify-between gap-2">
        <h3 class="line-clamp-2 min-w-0 text-sm font-semibold leading-tight transition-colors group-hover:text-primary">
          {{ title }}
        </h3>
        <span v-if="isR18 && !cover" class="movie-card-r18 shrink-0 text-[10px] font-bold uppercase text-red-300">
          R18
        </span>
      </div>

      <div class="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span class="font-mono font-semibold uppercase text-primary/85">{{ code }}</span>
        <span v-if="releaseDate" class="inline-flex items-center gap-1">
          <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></svg>
          {{ formatDate(releaseDate) }}
        </span>
      </div>

      <p v-if="actors?.length" class="movie-card-actors mt-2 line-clamp-1 text-xs text-muted-foreground">
        {{ actors.join(' · ') }}
      </p>
    </div>
  </RouterLink>
</template>

<style scoped>
.movie-card[data-layout='grid'] .movie-card-poster {
  aspect-ratio: 2 / 3;
}

.movie-card[data-layout='list'] {
  display: grid;
  grid-template-columns: 6.75rem minmax(0, 1fr);
  gap: 0.875rem;
  border: 1px solid hsl(var(--border));
  border-radius: var(--ui-radius-lg);
  background: hsl(var(--card) / 0.72);
  padding: 0.75rem;
  transition: border-color var(--ui-motion-base) ease, background-color var(--ui-motion-base) ease, transform var(--ui-motion-base) ease;
}

.movie-card[data-layout='list']:hover {
  border-color: hsl(var(--primary) / 0.55);
  background: hsl(var(--card));
  transform: translateY(-1px);
}

.movie-card[data-layout='list'] .movie-card-poster {
  aspect-ratio: 2 / 3;
}

.movie-card[data-layout='list'] .movie-card-overlay {
  display: none;
}

.movie-card[data-layout='list'] .movie-card-body {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.movie-card[data-layout='list'] .movie-card-body > div:first-child {
  margin-top: 0;
}

.movie-card[data-layout='list'] .movie-card-code {
  display: none;
}

@media (max-width: 420px) {
  .movie-card[data-layout='list'] {
    grid-template-columns: 5.5rem minmax(0, 1fr);
  }
}
</style>
