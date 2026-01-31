<script setup lang="ts">
import { signIn } from '~/lib/auth-client'

const route = useRoute()
const loading = ref(false)

// 错误信息处理
const error = computed(() => {
  const err = route.query.error as string
  if (err === 'insufficient_permissions')
    return '权限不足：需要管理员身份。'
  return err
})

// 获取回跳地址
// 默认跳回主站首页，或者指定的 redirect 路径
const redirectPath = computed(() => (route.query.redirect as string) || '/')

async function handleGitHubLogin() {
  loading.value = true

  // 构建绝对路径的 Callback URL
  // 例如：https://starye.org/movie/
  const callbackURL = new URL(redirectPath.value, window.location.origin).toString()
  
  console.log('[Login] callbackURL:', callbackURL)

  await signIn.social({
    provider: 'github',
    callbackURL,
  })
}
</script>

<template>
  <div class="flex items-center justify-center min-h-[calc(100vh-200px)] px-4">
    <div class="w-full max-w-sm p-10 space-y-8 bg-card rounded-3xl border border-border/40 shadow-xl text-center">
      <div class="space-y-3">
        <h1 class="text-3xl font-extrabold tracking-tight">
          STARYE ID
        </h1>
        <p class="text-sm text-muted-foreground">
          统一认证中心
        </p>
      </div>

      <!-- 错误提示 -->
      <div v-if="error" class="p-4 bg-red-500/10 text-red-500 text-xs rounded-xl font-bold border border-red-500/20">
        {{ error }}
      </div>

      <div class="py-4">
        <button
          :disabled="loading"
          class="w-full flex items-center justify-center gap-3 px-6 py-4 bg-neutral-900 text-white hover:bg-neutral-800 rounded-2xl font-bold transition-all disabled:opacity-50 shadow-lg hover:shadow-neutral-500/20"
          @click="handleGitHubLogin"
        >
          <svg v-if="loading" class="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <svg v-else class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
          通过 GitHub 登录
        </button>
      </div>

      <p class="text-[10px] text-muted-foreground uppercase tracking-widest">
        Protected by Better Auth
      </p>
    </div>
  </div>
</template>
