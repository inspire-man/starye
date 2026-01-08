import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: [
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
      exclude: ['@starye/locales'],
    },
  },

  // Global CSS
  css: ['./app/assets/css/main.css'],

  runtimeConfig: {
    public: {
      // eslint-disable-next-line node/prefer-global/process
      apiUrl: process.env.VITE_API_URL || 'http://localhost:8080',
    },
  },

  // Deployment configuration
  nitro: {
    preset: 'cloudflare-pages',
  },
})
