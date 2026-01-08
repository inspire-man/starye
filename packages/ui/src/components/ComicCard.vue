<script setup lang="ts">
interface Props {
  title: string
  href: string
  cover?: string | null
  author?: string | null
  isR18?: boolean
  // i18n 文本传入
  labelAdultOnly?: string
  labelUnknownAuthor?: string
}

withDefaults(defineProps<Props>(), {
  labelAdultOnly: 'Adult Only',
  labelUnknownAuthor: 'Unknown Author'
})
</script>

<template>
  <RouterLink :to="href" class="group cursor-pointer block text-left">
    <div class="aspect-[3/4] overflow-hidden rounded-xl bg-muted mb-3 border shadow-sm group-hover:shadow-md group-hover:ring-2 ring-primary transition-all duration-300 relative">
      <img
        v-if="cover"
        :src="cover"
        :alt="title"
        loading="lazy"
        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
      />
      
      <!-- Placeholder / R18 Mask -->
      <div v-else class="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-neutral-100 dark:bg-neutral-900">
        <span class="text-3xl mb-2">🔞</span>
        <span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{{ labelAdultOnly }}</span>
      </div>

      <!-- R18 Badge (Overlay on cover) -->
      <div v-if="isR18 && cover" class="absolute top-2 right-2 px-1.5 py-0.5 bg-black/60 backdrop-blur text-white text-[9px] font-bold rounded border border-white/20 uppercase">
        R18
      </div>
    </div>

    <h3 class="font-bold leading-tight line-clamp-2 text-sm group-hover:text-primary transition-colors">
      {{ title }}
    </h3>
    
    <p class="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      {{ author || labelUnknownAuthor }}
    </p>
  </RouterLink>
</template>
