import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // eslint-disable-next-line node/prefer-global/process
  base: process.env.NODE_ENV === 'production' ? '/' : '/dashboard/',
  server: {
    port: 5173,
    host: '0.0.0.0',
  },
})
