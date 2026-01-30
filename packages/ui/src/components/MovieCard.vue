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
}

withDefaults(defineProps<Props>(), {
  labelAdultOnly: 'R18',
})

function formatDate(date?: Date | null) {
  if (!date)
    return ''
  return new Date(date).toLocaleDateString()
}
</script>

<template>
  <RouterLink :to="href" class="group cursor-pointer block text-left">
    <div class="aspect-2/3 overflow-hidden rounded-xl bg-muted mb-3 border shadow-sm group-hover:shadow-md group-hover:ring-2 ring-primary transition-all duration-300 relative">
      <img
        v-if="cover"
        :src="cover"
        :alt="title"
        loading="lazy"
        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
      >

      <!-- Placeholder / R18 Mask -->
      <div v-else class="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-neutral-100 dark:bg-neutral-900">
        <span class="text-3xl mb-2">🔞</span>
        <span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{{ labelAdultOnly }}</span>
      </div>

      <!-- Code Badge -->
      <div class="absolute top-2 right-2 px-1.5 py-0.5 bg-black/60 backdrop-blur text-white text-[9px] font-bold rounded border border-white/20 uppercase">
        {{ code }}
      </div>

      <!-- R18 Badge -->
      <div v-if="isR18 && cover" class="absolute top-2 left-2 px-1.5 py-0.5 bg-red-600/80 backdrop-blur text-white text-[9px] font-bold rounded border border-white/20 uppercase">
        R18
      </div>
    </div>

    <h3 class="font-bold leading-tight line-clamp-2 text-sm group-hover:text-primary transition-colors">
      {{ title }}
    </h3>

    <p v-if="releaseDate" class="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></svg>
      {{ formatDate(releaseDate) }}
    </p>
  </RouterLink>
</template>
