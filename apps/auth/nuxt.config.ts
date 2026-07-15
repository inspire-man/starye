import { readFileSync } from 'node:fs'
import process from 'node:process'
import {
  buildNuxtPublicRuntimeEnv,
  parseNuxtPublicRuntimeEnv,
  parsePagesBuildEnvText,
} from '@starye/config/deployment-target'
import tailwindcss from '@tailwindcss/vite'

const pagesBuildEnvPath = process.env.STARYE_PAGES_BUILD_ENV_PATH
const isNuxtPrepare = process.argv.slice(2).includes('prepare')

if (!pagesBuildEnvPath && !isNuxtPrepare) {
  throw new Error('STARYE_PAGES_BUILD_ENV_PATH is required for the auth public runtime build.')
}

const publicRuntimeEnv = pagesBuildEnvPath
  ? buildNuxtPublicRuntimeEnv(
      parseNuxtPublicRuntimeEnv(parsePagesBuildEnvText(readFileSync(pagesBuildEnvPath, 'utf8'), 'auth'), 'auth'),
      'auth',
    )
  : undefined

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  app: {
    ...(publicRuntimeEnv ? { baseURL: publicRuntimeEnv.NUXT_PUBLIC_APP_BASE_PATH } : {}),
    head: {
      title: 'Starye ID',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Starye Unified Identity Service' },
      ],
    },
  },

  modules: [
    '@sentry/nuxt/module',
  ],

  // Tailwind v4 integration via Vite plugin
  vite: {
    plugins: [
      tailwindcss(),
    ],
  },

  // Global CSS
  css: ['./app/assets/css/main.css'],

  build: {
    transpile: ['@starye/ui'],
  },

  ...(publicRuntimeEnv
    ? {
        runtimeConfig: {
          public: {
            targetId: publicRuntimeEnv.NUXT_PUBLIC_TARGET_ID,
            gatewayBaseUrl: publicRuntimeEnv.NUXT_PUBLIC_GATEWAY_BASE_URL,
            apiBaseUrl: publicRuntimeEnv.NUXT_PUBLIC_API_BASE_URL,
            appBasePath: publicRuntimeEnv.NUXT_PUBLIC_APP_BASE_PATH,
            sentryDsn: publicRuntimeEnv.NUXT_PUBLIC_SENTRY_DSN,
            sentryRelease: publicRuntimeEnv.NUXT_PUBLIC_SENTRY_RELEASE,
            buildMode: publicRuntimeEnv.NUXT_PUBLIC_BUILD_MODE,
          },
        },
      }
    : {}),

  sentry: {
    enabled: true,
    autoInjectServerSentry: 'top-level-import',
  },

  // Deployment configuration
  nitro: {
    preset: 'cloudflare-pages',
  },

  // Source directory
  srcDir: 'app/',
})
