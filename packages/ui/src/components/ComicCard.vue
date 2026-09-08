<script setup lang="ts">
import { ImageOff, LockKeyhole, UserRound } from 'lucide-vue-next'
import { ref, watch } from 'vue'

interface Props {
  title: string
  href: string
  cover?: string | null
  author?: string | null
  isR18?: boolean
  restricted?: boolean
  region?: string | null
  status?: string | null
  // i18n 文本传入
  labelAdultOnly?: string
  labelMissingCover?: string
  labelUnknownAuthor?: string
  labelSerializing?: string
  labelCompleted?: string
}

const props = withDefaults(defineProps<Props>(), {
  labelAdultOnly: '需要 R18 访问权限',
  labelMissingCover: 'No Cover',
  labelUnknownAuthor: 'Unknown Author',
  labelSerializing: 'Serializing',
  labelCompleted: 'Completed',
})

const imageFailed = ref(false)
watch(() => props.cover, () => {
  imageFailed.value = false
})
function handleImageError(): void {
  imageFailed.value = true
}

function getStatusClass(status?: string | null) {
  if (status === 'serializing')
    return 'ui-status-info'
  if (status === 'completed')
    return 'ui-status-success'
  return 'ui-status-neutral'
}
</script>

<template>
  <RouterLink :to="href" :aria-label="`${title}${restricted ? `，${labelAdultOnly}` : ''}`" class="group block min-w-0 cursor-pointer rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background">
    <div class="relative mb-3 aspect-[3/4] overflow-hidden rounded-[var(--ui-radius-lg)] border border-border bg-muted shadow-sm transition-all duration-300 group-hover:-translate-y-0.5 group-hover:border-primary/55 group-hover:shadow-md">
      <img
        v-if="cover && !restricted && !imageFailed"
        :src="cover"
        :alt="title"
        loading="lazy"
        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        @error="handleImageError"
      >

      <!-- Placeholder / R18 Mask -->
      <div v-else class="flex h-full w-full flex-col items-center justify-center bg-muted p-4 text-center">
        <LockKeyhole v-if="restricted" aria-hidden="true" class="mb-2 h-6 w-6 text-muted-foreground" />
        <ImageOff v-else aria-hidden="true" class="mb-2 h-6 w-6 text-muted-foreground" />
        <span class="text-xs font-medium leading-5 text-muted-foreground">{{ restricted ? labelAdultOnly : imageFailed ? '图片加载失败' : labelMissingCover }}</span>
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

    <h3 :title="title" class="line-clamp-2 min-h-10 break-words text-sm font-semibold leading-5 transition-colors group-hover:text-primary">
      {{ title }}
    </h3>

    <p class="mt-1.5 flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
      <UserRound aria-hidden="true" class="h-3 w-3 shrink-0" />
      <span class="truncate">{{ author || labelUnknownAuthor }}</span>
    </p>
  </RouterLink>
</template>
