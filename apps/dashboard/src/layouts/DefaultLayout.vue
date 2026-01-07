<script setup lang="ts">
import { LayoutDashboard, BookOpen } from 'lucide-vue-next'
</script>

<template>
  <div class="flex min-h-screen bg-background text-foreground font-sans">
    <!-- Sidebar -->
    <aside class="w-64 border-r bg-card hidden md:block">
      <div class="p-6">
        <h1 class="text-xl font-bold tracking-tight">Starye Dash</h1>
      </div>
      <nav class="px-3 space-y-1 text-muted-foreground">
        <router-link 
          to="/" 
          class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all hover:bg-accent hover:text-accent-foreground" 
          active-class="bg-accent text-accent-foreground shadow-sm font-semibold"
        >
          <LayoutDashboard :size="18" />
          概览
        </router-link>
        <router-link 
          to="/comics" 
          class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all hover:bg-accent hover:text-accent-foreground" 
          active-class="bg-accent text-accent-foreground shadow-sm font-semibold"
        >
          <BookOpen :size="18" />
          漫画管理
        </router-link>
      </nav>
    </aside>

    <!-- Main -->
    <main class="flex-1 flex flex-col min-w-0 h-screen">
      <header class="h-14 border-b flex items-center px-8 bg-card/50 backdrop-blur flex-shrink-0">
        <div class="flex-1"></div>
        <div class="flex items-center gap-4">
           <div class="h-8 w-8 rounded-full bg-primary/10 border flex items-center justify-center text-primary font-bold text-xs">
             A
           </div>
        </div>
      </header>
      <div class="p-8 flex-1 overflow-y-auto">
        <router-view />
      </div>
    </main>
  </div>
</template>
