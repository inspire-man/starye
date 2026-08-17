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
  // i18n 文本传入
  labelAdultOnly?: string
  labelMissingCover?: string
}

withDefaults(defineProps<Props>(), {
  labelAdultOnly: 'R18',
  labelMissingCover: 'No Cover',
})

function formatDate(date?: Date | null) {
  if (!date)
    return ''
  return new Date(date).toLocaleDateString()
}
</script>

<template>
  <RouterLink :to="href" class="group cursor-pointer block text-left">
    <div class="relative mb-3 aspect-[2/3] overflow-hidden rounded-[var(--ui-radius-lg)] border border-border bg-muted shadow-sm transition-all duration-300 group-hover:-translate-y-0.5 group-hover:border-primary/55 group-hover:shadow-md">
      <img
        v-if="cover"
        :src="cover"
        :alt="title"
        loading="lazy"
        class="w-full h-full object-cover object-right group-hover:scale-105 transition-transform duration-500"
      >

      <!-- Placeholder / R18 Mask -->
      <div v-else class="flex h-full w-full flex-col items-center justify-center bg-muted p-4 text-center">
        <span class="mb-2 text-3xl">{{ isR18 ? '🔞' : '🖼️' }}</span>
        <span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{{ isR18 ? labelAdultOnly : labelMissingCover }}</span>
      </div>

      <!-- Code Badge -->
      <div class="absolute right-2 top-2 rounded border border-white/20 bg-black/60 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white backdrop-blur">
        {{ code }}
      </div>

      <!-- R18 Badge -->
      <div v-if="isR18 && cover" class="ui-status-tag ui-status-danger absolute left-2 top-2 border-white/30 bg-black/55 text-white backdrop-blur">
        R18
      </div>
    </div>

    <h3 class="line-clamp-2 text-sm font-semibold leading-tight transition-colors group-hover:text-primary">
      {{ title }}
    </h3>

    <p v-if="releaseDate" class="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></svg>
      {{ formatDate(releaseDate) }}
    </p>
  </RouterLink>
</template>
