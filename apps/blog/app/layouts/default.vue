<template>
  <div class="min-h-screen bg-background font-sans text-foreground antialiased">
    <header class="border-b p-4">
      <nav class="container mx-auto flex items-center justify-between">
        <h1 class="text-xl font-bold">Starye Blog</h1>
        <div class="flex gap-4">
          <NuxtLink to="/" class="hover:underline">Home</NuxtLink>
        </div>
      </nav>
    </header>
    <main class="container mx-auto p-4">
      <slot />
    </main>
  </div>
</template>
