import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  app: {
    baseURL: '/blog/',
  },

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
    // 内联翻译，避免加载外部文件导致 404
    messages: {
      en: {
        welcome: 'Welcome to Starye Blog',
      },
      zh: {
        welcome: '欢迎来到星野博客',
      },
    },
  },

  // Tailwind v4 integration via Vite plugin
  vite: {
    plugins: [
      tailwindcss() as any,
    ],
    optimizeDeps: {
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
      // eslint-disable-next-line node/prefer-global/process
      apiUrl: process.env.NUXT_PUBLIC_API_URL || process.env.VITE_API_URL || 'http://localhost:8080',
    },
  },

  // Deployment configuration
  nitro: {
    preset: 'cloudflare-pages',
  },
})
