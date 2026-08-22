import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const appRoot = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(appRoot, './src'),
    },
    dedupe: ['vue'],
  },
  base: '/quant/',
  server: {
    host: '0.0.0.0',
    port: 3004,
    hmr: {
      host: 'localhost',
      clientPort: 3004,
    },
  },
})
