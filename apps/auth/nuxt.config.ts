import { env } from 'node:process'
import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  app: {
    baseURL: '/auth/',
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

  // Source directory
  srcDir: 'app/',
})
