/**
 * RSS 2.0 Feed — /feed.xml
 * 输出最新 50 篇已发布文章的 RSS 2.0 格式数据
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const apiUrl = config.public.apiUrl as string
  const siteUrl = 'https://starye.com/blog'

  let posts: Array<{
    title: string
    slug: string
    excerpt?: string | null
    createdAt: string
    author?: { name: string } | null
    tags?: string[] | null
  }> = []

  try {
    const res = await $fetch<{ data: typeof posts }>('/api/posts', {
      baseURL: apiUrl,
      query: { limit: 50 },
    })
    posts = res.data || []
  }
  catch {
    posts = []
  }

  function escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  }

  const items = posts.map(post => `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${siteUrl}/${escapeXml(post.slug)}</link>
      <guid isPermaLink="true">${siteUrl}/${escapeXml(post.slug)}</guid>
      <pubDate>${new Date(post.createdAt).toUTCString()}</pubDate>
      ${post.excerpt ? `<description>${escapeXml(post.excerpt)}</description>` : ''}
      ${post.author?.name ? `<author>${escapeXml(post.author.name)}</author>` : ''}
      ${(post.tags || []).map(t => `<category>${escapeXml(t)}</category>`).join('\n      ')}
    </item>`).join('')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Starye Blog</title>
    <link>${siteUrl}</link>
    <description>技术探索 · 全栈实践 · AI 辅助开发</description>
    <language>zh-CN</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}/feed.xml" rel="self" type="application/rss+xml"/>
    ${items}
  </channel>
</rss>`

  setHeader(event, 'Content-Type', 'application/rss+xml; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=3600')
  return xml
})
