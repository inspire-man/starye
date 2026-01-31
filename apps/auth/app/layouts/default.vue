<template>
  <div class="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/10">
    <main class="flex-1 flex flex-col items-center justify-center p-4">
      <slot />
    </main>
    <footer class="py-6 text-center text-xs text-muted-foreground">
      &copy; {{ new Date().getFullYear() }} Starye. All rights reserved.
    </footer>
  </div>
</template>
