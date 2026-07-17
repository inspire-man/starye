import path from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  define: {
    __STARYE_MOVIE_PUBLIC_RUNTIME__: JSON.stringify({
      targetId: 'test',
      gatewayBaseUrl: 'http://localhost:8080',
      apiBaseUrl: 'http://localhost:8080',
      appBasePath: '/movie/',
      buildMode: 'test',
      monitoringEnabled: false,
      aria2Enabled: true,
      aria2WebsocketEnabled: false,
      ratingEnabled: true,
      autoScoreEnabled: true,
      performanceMonitoringEnabled: false,
    }),
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/e2e/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/.{idea,git,cache,output,temp}/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'e2e/**',
        '**/*.test.ts',
        '**/*.config.ts',
        'src/main.ts',
        'src/router.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
