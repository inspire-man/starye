import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  // Tailwind v4 integration via Vite plugin
  vite: {
    plugins: [
      tailwindcss(),
    ],
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
