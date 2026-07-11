import { env } from 'node:process'
import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  app: {
    baseURL: '/blog/',
  },

  modules: [
    '@sentry/nuxt/module',
    '@nuxtjs/i18n',
  ],

  i18n: {
    locales: [
      { code: 'en', iso: 'en-US', name: 'English' },
      { code: 'zh', iso: 'zh-CN', name: '简体中文' },
    ],
    defaultLocale: 'zh',
    strategy: 'no_prefix',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'starye_i18n',
      redirectOn: 'root',
    },
  },

  // Tailwind v4 integration via Vite plugin
  vite: {
    plugins: [
      tailwindcss(),
    ],
    optimizeDeps: {
      include: [
        'better-auth/vue',
      ],
      exclude: ['@starye/locales'],
    },
  },

  // Global CSS
  css: ['./app/assets/css/main.css'],

  build: {
    transpile: ['@starye/ui'],
  },

  runtimeConfig: {
    public: {
      apiUrl: env.NUXT_PUBLIC_API_URL || env.VITE_API_URL || 'http://localhost:8080',
      sentryDsn: env.NUXT_PUBLIC_SENTRY_DSN || env.SENTRY_DSN || '',
    },
  },

  sentry: {
    enabled: true,
    autoInjectServerSentry: 'top-level-import',
  },

  // Deployment configuration
  nitro: {
    preset: 'cloudflare-pages',
  },
})
