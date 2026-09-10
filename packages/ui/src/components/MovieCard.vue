<script setup lang="ts">
import { CalendarDays, ImageOff, LockKeyhole } from 'lucide-vue-next'
import { ref, watch } from 'vue'
import { canRenderMedia } from '../lib/media-status'

interface Props {
  title: string
  href: string
  code: string
  cover?: string | null
  releaseDate?: Date | null
  isR18?: boolean
  restricted?: boolean
  actors?: string[] | null
  genres?: string[] | null
  layout?: 'grid' | 'list'
  // i18n 文本传入
  labelAdultOnly?: string
  labelMissingCover?: string
}

const props = withDefaults(defineProps<Props>(), {
  labelAdultOnly: 'R18',
  labelMissingCover: 'No Cover',
  layout: 'grid',
})

const imageFailed = ref(false)
watch(() => props.cover, () => {
  imageFailed.value = false
})
function handleImageError(): void {
  imageFailed.value = true
}

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
    :aria-label="`${code} ${title}${restricted ? '，需要 R18 访问权限' : ''}`"
    class="movie-card group block min-w-0 cursor-pointer rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
  >
    <div class="movie-card-poster relative overflow-hidden rounded-[var(--ui-radius-lg)] border border-border bg-muted shadow-sm transition-all duration-300 group-hover:-translate-y-0.5 group-hover:border-primary/55 group-hover:shadow-md">
      <img
        v-if="canRenderMedia(cover, imageFailed) && !restricted"
        :src="cover || undefined"
        :alt="title"
        loading="lazy"
        class="movie-card-image h-full w-full object-contain transition-transform duration-500 motion-reduce:transition-none"
        @error="handleImageError"
      >

      <!-- Placeholder / R18 Mask -->
      <div v-else class="movie-card-placeholder flex h-full w-full flex-col items-center justify-center bg-muted p-4 text-center">
        <LockKeyhole v-if="restricted" aria-hidden="true" class="mb-2 h-6 w-6 text-muted-foreground" />
        <ImageOff v-else aria-hidden="true" class="mb-2 h-6 w-6 text-muted-foreground" />
        <span class="text-xs font-medium leading-5 text-muted-foreground">{{ restricted ? '需要 R18 访问权限' : imageFailed ? '图片加载失败' : labelMissingCover }}</span>
      </div>

      <div v-if="isR18 && layout !== 'list'" class="ui-status-tag ui-status-danger absolute left-2 top-2 border-white/30 bg-black/55 text-white backdrop-blur">
        {{ labelAdultOnly }}
      </div>

      <div class="movie-card-overlay absolute inset-x-0 bottom-0 flex translate-y-2 items-center justify-between gap-2 bg-black/72 px-3 py-2 text-xs font-semibold text-white opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
        <span>查看详情</span>
        <span aria-hidden="true">↗</span>
      </div>
    </div>

    <div class="movie-card-body min-w-0">
      <div class="mt-3 flex min-w-0 items-start justify-between gap-2">
        <h3 :title="title" class="line-clamp-2 min-h-10 min-w-0 break-words text-sm font-semibold leading-5 transition-colors group-hover:text-primary">
          {{ title }}
        </h3>
      </div>

      <div class="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span class="font-mono font-semibold uppercase text-primary/85">{{ code }}</span>
        <span v-if="isR18 && layout === 'list'" class="text-[10px] font-semibold text-muted-foreground">{{ labelAdultOnly }}</span>
        <span v-if="releaseDate" class="inline-flex items-center gap-1">
          <CalendarDays aria-hidden="true" class="h-3 w-3 shrink-0" />
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
  aspect-ratio: 3 / 4;
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
  aspect-ratio: 3 / 4;
}

.movie-card[data-layout='list'] .movie-card-overlay {
  display: none;
}

.movie-card[data-layout='list'] .movie-card-placeholder {
  padding: 0.375rem;
}

.movie-card[data-layout='list'] .movie-card-placeholder svg {
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

@media (max-width: 420px) {
  .movie-card[data-layout='list'] {
    grid-template-columns: 5.5rem minmax(0, 1fr);
  }
}

@media (prefers-reduced-motion: reduce) {
  .movie-card,
  .movie-card-poster,
  .movie-card-image,
  .movie-card-overlay {
    transition: none;
    transform: none;
  }
}
</style>
