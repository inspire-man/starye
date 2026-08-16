<script setup lang="ts">
interface Props {
  title: string
  href: string
  cover?: string | null
  author?: string | null
  isR18?: boolean
  region?: string | null
  status?: string | null
  // i18n 文本传入
  labelAdultOnly?: string
  labelMissingCover?: string
  labelUnknownAuthor?: string
  labelSerializing?: string
  labelCompleted?: string
}

withDefaults(defineProps<Props>(), {
  labelAdultOnly: 'Adult Only',
  labelMissingCover: 'No Cover',
  labelUnknownAuthor: 'Unknown Author',
  labelSerializing: 'Serializing',
  labelCompleted: 'Completed',
})

function getStatusClass(status?: string | null) {
  if (status === 'serializing')
    return 'ui-status-info'
  if (status === 'completed')
    return 'ui-status-success'
  return 'ui-status-neutral'
}
</script>

<template>
  <RouterLink :to="href" class="group cursor-pointer block text-left">
    <div class="relative mb-3 aspect-[3/4] overflow-hidden rounded-[var(--ui-radius-lg)] border border-border bg-muted shadow-sm transition-all duration-300 group-hover:-translate-y-0.5 group-hover:border-primary/55 group-hover:shadow-md">
      <img
        v-if="cover"
        :src="cover"
        :alt="title"
        loading="lazy"
        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
      >

      <!-- Placeholder / R18 Mask -->
      <div v-else class="flex h-full w-full flex-col items-center justify-center bg-muted p-4 text-center">
        <span class="mb-2 text-3xl">{{ isR18 ? '🔞' : '🖼️' }}</span>
        <span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{{ isR18 ? labelAdultOnly : labelMissingCover }}</span>
      </div>

      <!-- R18 Badge (Overlay on cover) -->
      <div v-if="isR18 && cover" class="ui-status-tag ui-status-danger absolute right-2 top-2 border-white/30 bg-black/55 text-white backdrop-blur">
        R18
      </div>

      <!-- Region Badge (Overlay on cover) -->
      <div v-if="region" class="ui-status-tag ui-status-neutral absolute bottom-2 left-2 backdrop-blur">
        {{ region }}
      </div>

      <!-- Status Badge -->
      <div v-if="status" class="ui-status-tag absolute left-2 top-2 backdrop-blur" :class="getStatusClass(status)">
        {{ status === 'serializing' ? labelSerializing : labelCompleted }}
      </div>
    </div>

    <h3 class="line-clamp-2 text-sm font-semibold leading-tight transition-colors group-hover:text-primary">
      {{ title }}
    </h3>

    <p class="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
      {{ author || labelUnknownAuthor }}
    </p>
  </RouterLink>
</template>
