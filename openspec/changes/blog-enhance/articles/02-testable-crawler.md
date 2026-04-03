---
title: 拒绝 Puppeteer 黑盒：如何编写可测试的爬虫代码
slug: ts-fullstack-ai-02-testable-crawler
series: ts-fullstack-ai-chronicle
seriesOrder: 2
tags: ["puppeteer", "vitest", "testing", "web-scraping", "happydom", "clean-architecture"]
excerpt: 把解析逻辑全塞进 page.evaluate() 是维护噩梦。本文介绍如何通过「获取与解析分离」，让爬虫代码变得可测试、可调试、可复用。
---

## 问题：page.evaluate() 是个黑盒

最初写爬虫时，我把所有逻辑都塞进了 Puppeteer 的 `page.evaluate()` 里：

```typescript
// ❌ 反模式：逻辑全在 evaluate 里
const result = await page.evaluate(() => {
  const title = document.querySelector('.comic-title')?.textContent?.trim()
  const chapters = Array.from(document.querySelectorAll('.chapter-list a'))
    .map(a => ({
      title: a.textContent?.trim(),
      url: (a as HTMLAnchorElement).href,
    }))
  return { title, chapters }
})
```

乍看没什么问题，但维护一段时间后，问题接二连三：

**问题 1：IDE 无法调试**

`evaluate()` 里的代码在浏览器沙箱中运行，VS Code 的断点完全失效。出了 bug 只能靠 `console.log` 盲调。

**问题 2：无法使用 TypeScript 外部类型**

浏览器沙箱是隔离的——你在外面定义的接口、工具函数，在 `evaluate()` 里用不了。想要类型安全？没门。

**问题 3：测试必须真实联网**

验证解析逻辑，必须启动 Puppeteer、打开真实网页、等待网络响应。一个测试动辄 5-10 秒，而且网络抖动会让测试随机失败。

**问题 4：错误信息丢失堆栈**

浏览器报错经过序列化传回 Node.js，堆栈信息往往只剩一句 `Error: ...`，定位问题极其困难。

## 解决方案：获取与解析分离

核心思路很简单：**让 Puppeteer 只负责获取 HTML，解析逻辑完全放到 Node.js 环境中**。

```
❌ Before:
  Browser (Fetch + Parse) → Data

✅ After:
  Browser (Fetch only) → HTML String → Node.js (Parser) → Data
```

### 第一步：Puppeteer 只获取 HTML

```typescript
// site-strategy.ts - 只做 "获取"
import type { Page } from 'puppeteer'

export async function fetchPageHtml(page: Page, url: string): Promise<string> {
  await page.goto(url, { waitUntil: 'networkidle2' })
  return page.content() // 返回完整 HTML 字符串
}
```

### 第二步：纯函数解析器

```typescript
// site-parser.ts - 纯函数，不依赖 Puppeteer
import { Window } from 'happy-dom'

export interface ComicInfo {
  title: string
  chapters: Array<{ title: string, url: string }>
  coverImage: string | null
}

export function parseComicDetail(html: string): ComicInfo {
  const window = new Window()
  const document = window.document
  document.write(html)

  const title = document.querySelector('.comic-title')?.textContent?.trim() ?? ''
  
  const chapters = Array.from(document.querySelectorAll('.chapter-list a'))
    .map((a) => {
      const anchor = a as HTMLAnchorElement
      return {
        title: anchor.textContent?.trim() ?? '',
        url: anchor.href,
      }
    })

  const coverImage = (document.querySelector('.cover img') as HTMLImageElement)?.src ?? null

  window.happyDOM.cancelAsync()
  
  return { title, chapters, coverImage }
}
```

### 第三步：组合使用

```typescript
// 在策略层组合两者
const html = await fetchPageHtml(page, comicUrl)
const info = parseComicDetail(html) // 纯函数，可测试
```

## 为什么选 happy-dom 而不是 jsdom？

我评估了两个主流的 Node.js DOM 模拟库：

| 维度 | happy-dom | jsdom |
|------|-----------|-------|
| 速度 | 更快（2-10x） | 较慢 |
| 包大小 | 更小 | 较大 |
| API 完整性 | 足够爬虫使用 | 更完整 |
| CSS 支持 | 基础 | 更好 |
| 社区 | 活跃增长 | 成熟稳定 |

对于爬虫场景，我们只需要基础的 DOM 查询（`querySelector`、`textContent`、`href`），happy-dom 完全够用，而且速度优势显著。

## 建立测试体系

有了纯函数解析器，写单元测试变得极其简单：

### Fixture 测试文件

先保存一份真实 HTML 作为 Fixture（`__fixtures__/comic-detail.html`），这样测试完全离线运行：

```html
<!-- __fixtures__/comic-detail.html (部分) -->
<h1 class="comic-title">测试漫画标题</h1>
<div class="chapter-list">
  <a href="/chapter/1">第 1 话</a>
  <a href="/chapter/2">第 2 话</a>
</div>
```

### Vitest 单元测试

```typescript
// site-parser.test.ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseComicDetail } from './site-parser'

describe('parseComicDetail', () => {
  const html = readFileSync(
    resolve(__dirname, '__fixtures__/comic-detail.html'),
    'utf-8',
  )

  it('应正确提取漫画标题', () => {
    const result = parseComicDetail(html)
    expect(result.title).toBe('测试漫画标题')
  })

  it('应正确提取章节列表', () => {
    const result = parseComicDetail(html)
    expect(result.chapters).toHaveLength(2)
    expect(result.chapters[0]).toEqual({
      title: '第 1 话',
      url: '/chapter/1',
    })
  })

  it('网站结构变更时测试应明确失败', () => {
    const brokenHtml = '<div>结构完全变了</div>'
    const result = parseComicDetail(brokenHtml)
    expect(result.title).toBe('') // 有明确的失败结果，而不是运行时崩溃
  })
})
```

运行：

```bash
pnpm --filter crawler test
# ✓ site-parser (3)
# Duration: 8ms ← 毫秒级，无需网络
```

## 一个小坑：href 的处理

在用 happy-dom 解析 `href` 属性时，遇到了一个细节问题：

```typescript
// ❌ 问题：happy-dom 中 a.href 会返回完整 URL（加上 baseURL）
// 而 a.getAttribute('href') 返回原始属性值

const anchor = a as HTMLAnchorElement

// 如果页面中 href="/chapter/1"：
anchor.href // 返回 "about:blank/chapter/1"（有时是这样）
anchor.getAttribute('href') // 返回 "/chapter/1" ✅
```

统一使用 `getAttribute('href')` 而非 `.href` 属性，避免环境差异：

```typescript
url: anchor.getAttribute('href') ?? ''
```

## 性能权衡

有人会问：把整个 HTML 序列化传给 Node.js，性能会不会有问题？

实测下来，一个漫画详情页 HTML 约 50-200KB，序列化传输的开销可以忽略不计。相比之下，**开发体验的提升是量级的**：

- 测试从「5秒/需要联网」降到「8毫秒/完全离线」
- Bug 定位从「盲调 console.log」变为「直接 IDE 断点」
- 重构变得安全：测试保护着你的解析逻辑

## 经验总结

### Checklist：编写可测试爬虫的原则

- [ ] **获取与解析分离**：Browser 只负责获取 HTML，解析逻辑在 Node.js 环境中
- [ ] **解析器是纯函数**：输入 HTML 字符串，输出结构化数据，无副作用
- [ ] **使用 happy-dom 模拟 DOM**：无需真实浏览器即可在 Node.js 中运行 DOM 查询
- [ ] **保存真实 HTML 作为 Fixture**：测试完全离线，结果稳定
- [ ] **用 `getAttribute` 而非直接访问属性**：避免 happy-dom 的 URL 处理差异
- [ ] **测试边界情况**：网站结构变更时测试应明确失败，而非静默错误

这个模式不仅适用于 Puppeteer，同样适用于 Cheerio、Playwright 等任何爬虫工具。关键是：**把「业务逻辑」和「I/O 操作」分开**。
