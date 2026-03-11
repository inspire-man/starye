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
  // 始终使用 /dashboard/ 作为 base，与 Gateway 路由保持一致
  base: '/dashboard/',
  server: {
    port: 5173,
    host: '0.0.0.0',
  },
})
