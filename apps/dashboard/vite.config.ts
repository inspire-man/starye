import { readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import {
  buildVitePublicRuntimeEnv,
  parsePagesBuildEnvText,
  parseVitePublicRuntimeEnv,
} from '@starye/config/deployment-target'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const pagesBuildEnvPath = process.env.STARYE_PAGES_BUILD_ENV_PATH
if (!pagesBuildEnvPath) {
  throw new Error('STARYE_PAGES_BUILD_ENV_PATH is required for the dashboard public runtime build.')
}

const publicRuntimeEnv = buildVitePublicRuntimeEnv(
  parseVitePublicRuntimeEnv(parsePagesBuildEnvText(readFileSync(pagesBuildEnvPath, 'utf8'), 'dashboard'), 'dashboard'),
  'dashboard',
)

export default defineConfig(() => ({
  plugins: [
    vue(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    dedupe: ['vue', 'vue-router'],
  },
  base: publicRuntimeEnv.VITE_APP_BASE_PATH,
  define: {
    __STARYE_DASHBOARD_PUBLIC_RUNTIME__: JSON.stringify({
      targetId: publicRuntimeEnv.VITE_TARGET_ID,
      gatewayBaseUrl: publicRuntimeEnv.VITE_GATEWAY_BASE_URL,
      apiBaseUrl: publicRuntimeEnv.VITE_API_BASE_URL,
      appBasePath: publicRuntimeEnv.VITE_APP_BASE_PATH,
      sentryDsn: publicRuntimeEnv.VITE_SENTRY_DSN,
      sentryRelease: publicRuntimeEnv.VITE_SENTRY_RELEASE,
      buildMode: publicRuntimeEnv.VITE_BUILD_MODE,
    }),
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
  },
}))
