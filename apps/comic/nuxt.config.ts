// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },

  // 启用 Nuxt 4 目录结构
  future: {
    compatibilityVersion: 4,
  },

  // 模块配置
  modules: ['@nuxtjs/tailwindcss'],

  // Tailwind v4 配置
  css: ['@starye/ui/assets/globals.css'],

  runtimeConfig: {
    public: {
      // eslint-disable-next-line node/prefer-global/process
      apiUrl: process.env.VITE_API_URL || 'http://localhost:8787',
    },
  },
})
