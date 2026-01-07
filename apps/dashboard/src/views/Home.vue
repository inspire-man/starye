<template>
  <div class="space-y-4">
    <h1 class="text-2xl font-bold tracking-tight">概览</h1>
    <p class="text-muted-foreground">欢迎回来。系统当前运行正常。</p>
    
    <div class="grid gap-4 md:grid-cols-3">
      <div class="p-6 border rounded-xl bg-card shadow-sm">
        <div class="text-sm font-medium text-muted-foreground">总漫画数</div>
        <div class="text-2xl font-bold mt-1">-</div>
      </div>
      <div class="p-6 border rounded-xl bg-card shadow-sm">
        <div class="text-sm font-medium text-muted-foreground">待处理任务</div>
        <div class="text-2xl font-bold mt-1">0</div>
      </div>
    </div>
  </div>
</template>
