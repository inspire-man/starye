import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig(({ mode }) => ({
  plugins: [
    vue(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // 开发环境: 使用 /dashboard/ 与 Gateway 路由保持一致
  // 生产环境: 使用 / 因为部署到独立的 Cloudflare Pages 项目
  base: mode === 'production' ? '/' : '/dashboard/',
  server: {
    port: 5173,
    host: '0.0.0.0',
  },
}))
