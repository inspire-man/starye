import { readFileSync } from 'node:fs'
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
  throw new Error('STARYE_PAGES_BUILD_ENV_PATH is required for the movie public runtime build.')
}

const publicRuntimeEnv = buildVitePublicRuntimeEnv(
  parseVitePublicRuntimeEnv(parsePagesBuildEnvText(readFileSync(pagesBuildEnvPath, 'utf8'), 'movie'), 'movie'),
  'movie',
)

export default defineConfig(() => ({
  plugins: [
    vue(),
    tailwindcss(),
  ],
  base: publicRuntimeEnv.VITE_APP_BASE_PATH,
  define: {
    __STARYE_MOVIE_PUBLIC_RUNTIME__: JSON.stringify({
      targetId: publicRuntimeEnv.VITE_TARGET_ID,
      gatewayBaseUrl: publicRuntimeEnv.VITE_GATEWAY_BASE_URL,
      apiBaseUrl: publicRuntimeEnv.VITE_API_BASE_URL,
      appBasePath: publicRuntimeEnv.VITE_APP_BASE_PATH,
      sentryDsn: publicRuntimeEnv.VITE_SENTRY_DSN,
      sentryRelease: publicRuntimeEnv.VITE_SENTRY_RELEASE,
      buildMode: publicRuntimeEnv.VITE_BUILD_MODE,
      monitoringEnabled: publicRuntimeEnv.VITE_MONITORING_ENABLED === 'true',
      aria2Enabled: publicRuntimeEnv.VITE_FEATURE_ARIA2 === 'true',
      aria2WebsocketEnabled: publicRuntimeEnv.VITE_FEATURE_ARIA2_WS === 'true',
      ratingEnabled: publicRuntimeEnv.VITE_FEATURE_RATING === 'true',
      autoScoreEnabled: publicRuntimeEnv.VITE_FEATURE_AUTO_SCORE === 'true',
      performanceMonitoringEnabled: publicRuntimeEnv.VITE_FEATURE_PERF_MONITOR === 'true',
    }),
  },
}))
