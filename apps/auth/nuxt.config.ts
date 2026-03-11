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

  // Tailwind v4 integration via Vite plugin
  vite: {
    plugins: [
      tailwindcss() as any,
    ],
  },

  // Global CSS
  css: ['./app/assets/css/main.css'],

  build: {
    transpile: ['@starye/ui'],
  },

  runtimeConfig: {
    public: {
      // eslint-disable-next-line node/prefer-global/process
      apiUrl: process.env.NUXT_PUBLIC_API_URL || process.env.VITE_API_URL || 'http://localhost:8080',
    },
  },

  // Deployment configuration
  nitro: {
    preset: 'cloudflare-pages',
  },

  // Source directory
  srcDir: 'app/',
})
