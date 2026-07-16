import { createHighlighter } from 'shiki'

/**
 * 初始化 Shiki 高亮器并挂载到 NuxtApp
 * 支持主流语言和 GitHub 明/暗主题
 */
export default defineNuxtPlugin(async () => {
  const highlighter = await createHighlighter({
    themes: ['github-dark', 'github-light'],
    langs: [
      'javascript',
      'typescript',
      'vue',
      'html',
      'css',
      'scss',
      'json',
      'jsonc',
      'bash',
      'sh',
      'python',
      'rust',
      'go',
      'sql',
      'yaml',
      'toml',
      'markdown',
      'tsx',
      'jsx',
      'diff',
    ],
  })

  return {
    provide: {
      shiki: highlighter,
    },
  }
})
