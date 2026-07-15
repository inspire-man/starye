import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  define: {
    __STARYE_DASHBOARD_PUBLIC_RUNTIME__: JSON.stringify({
      targetId: 'test',
      gatewayBaseUrl: 'http://localhost:8080',
      apiBaseUrl: 'http://localhost:8080',
      appBasePath: '/dashboard/',
      buildMode: 'test',
    }),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['**/node_modules/**', '**/e2e/**', '**/*.spec.ts'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
