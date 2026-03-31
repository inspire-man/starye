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
  // 统一使用 /dashboard/ 基础路径（本地和生产）
  // Gateway 会剥离此前缀后转发到 Pages（部署在根路径）
  base: '/dashboard/',
  server: {
    port: 5173,
    host: '0.0.0.0',
  },
}))
