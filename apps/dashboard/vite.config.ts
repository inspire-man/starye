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
  // 生产环境部署到 Cloudflare Pages 根路径，本地通过 Gateway /dashboard/ 访问
  base: mode === 'production' ? '/' : '/dashboard/',
  server: {
    port: 5173,
    host: '0.0.0.0',
  },
}))
