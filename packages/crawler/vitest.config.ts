import { defineConfig, mergeConfig } from 'vitest/config'
/// <reference types="vitest" />
import { baseVitestConfig } from '../../packages/config/vitest-base'

// 由于 @starye/config 是 workspace 依赖，我们可以尝试直接导入
// 如果导入失败，我们可以暂时复制配置或使用相对路径
// 为了稳健，这里先使用相对路径导入，或者稍后在 package.json 导出

export default mergeConfig(
  baseVitestConfig,
  defineConfig({
    test: {
      environment: 'happy-dom', // 关键：模拟浏览器 DOM 环境
    },
  }),
)
