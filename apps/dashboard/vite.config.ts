import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig(() => ({
  plugins: [
    vue(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // 统一使用 /dashboard/ 路径（与 Gateway 路由匹配）
  base: '/dashboard/',
  server: {
    port: 5173,
    host: '0.0.0.0',
  },
}))
