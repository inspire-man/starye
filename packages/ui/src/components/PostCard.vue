<script setup lang="ts">
interface Props {
  title: string
  href: string
  cover?: string | null
  excerpt?: string | null
  author?: string | null
  date?: string | null
}

defineProps<Props>()
</script>

<template>
  <RouterLink :to="href" class="group relative flex flex-col h-full overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm transition-all hover:shadow-md hover:border-primary/50">
    <!-- Cover Image -->
    <div class="aspect-video w-full overflow-hidden bg-muted relative">
      <img
        v-if="cover"
        :src="cover"
        :alt="title"
        loading="lazy"
        class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
      >
      <div v-else class="h-full w-full flex items-center justify-center text-muted-foreground bg-muted">
        <span class="text-4xl opacity-10">#</span>
      </div>
    </div>

    <!-- Content -->
    <div class="flex flex-1 flex-col p-5">
      <h2 class="text-xl font-bold tracking-tight mb-3 group-hover:text-primary transition-colors line-clamp-2">
        {{ title }}
      </h2>
      
      <p v-if="excerpt" class="text-muted-foreground text-sm line-clamp-3 mb-4 flex-1">
        {{ excerpt }}
      </p>

      <!-- Footer -->
      <div class="mt-auto flex items-center gap-3 text-xs text-muted-foreground pt-4 border-t border-border/50">
        <div v-if="author" class="flex items-center gap-1.5 font-medium">
          <div class="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <span>{{ author }}</span>
        </div>
        
        <span v-if="author && date" class="text-border mx-1">|</span>
        
        <time v-if="date" class="tabular-nums">
          {{ date }}
        </time>
      </div>
    </div>
  </RouterLink>
</template>
