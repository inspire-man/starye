import type { BundledLanguage, Highlighter } from 'shiki'
import { fromHighlighter } from '@shikijs/markdown-it/core'
import MarkdownIt from 'markdown-it'

/**
 * 返回配置了 Shiki 语法高亮的 markdown-it 实例
 * 若 Shiki 未初始化则降级为纯文本代码块
 */
export function useMarkdown() {
  const { $shiki } = useNuxtApp()

  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
  })

  if ($shiki) {
    md.use(
      fromHighlighter($shiki as Highlighter, {
        theme: 'github-dark',
        // 不设 fallbackLanguage，未识别的语言由 try/catch 降级
      }),
    )
  }

  return md
}

/**
 * 对 wangEditor 输出的 HTML 中的 <pre><code> 块进行 Shiki 高亮
 * 匹配 class="language-xxx" 格式，注入高亮 HTML
 */
export async function highlightHtmlContent(html: string): Promise<string> {
  const { $shiki } = useNuxtApp()
  if (!$shiki)
    return html

  const highlighter = $shiki as Highlighter
  const availableLangs = highlighter.getLoadedLanguages() as string[]

  // 匹配 <pre><code class="language-xxx">...</code></pre>
  return html.replace(
    /<pre><code(?:\s+class="language-([^"]*)")?>([\s\S]*?)<\/code><\/pre>/g,
    (_match, lang: string | undefined, code: string) => {
      // 解码 HTML 实体
      const decoded = code
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, '\'')

      // 仅使用已加载且合法的语言，否则原样返回
      if (!lang || !availableLangs.includes(lang)) {
        return _match
      }

      try {
        return highlighter.codeToHtml(decoded, {
          lang: lang as BundledLanguage,
          theme: 'github-dark',
        })
      }
      catch {
        return _match
      }
    },
  )
}
