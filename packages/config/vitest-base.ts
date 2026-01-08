/// <reference types="vitest" />
import type { UserConfigExport } from 'vitest/config'
import { defineConfig } from 'vitest/config'

export const baseVitestConfig: UserConfigExport = defineConfig({
  test: {
    globals: true, // 使用全局 describe, it, expect
    environment: 'node', // 默认环境，crawler 会覆盖为 happy-dom
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
    include: ['**/*.{test,spec}.{ts,js}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.turbo/**'],
  },
})
