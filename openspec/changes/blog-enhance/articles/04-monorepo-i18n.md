---
title: Monorepo i18n 架构：一个翻译包如何服务所有应用
slug: ts-fullstack-ai-04-monorepo-i18n
series: ts-fullstack-ai-chronicle
seriesOrder: 4
tags: ["monorepo", "i18n", "vue-i18n", "nuxt", "typescript", "architecture"]
excerpt: 当多个前端应用需要共享翻译文案时，如何避免「到处复制 JSON」的混乱？本文介绍 Monorepo 共享 Locale 包的实现方案。
---

## 问题：翻译文案的散落之痛

在项目早期，每个应用各自维护翻译文件：

```
apps/blog/locales/zh.json
apps/dashboard/locales/zh.json
apps/comic/locales/zh.json
```

表面上看没问题，但很快就出现了：

- Dashboard 和 Comic 都有「发布」按钮，翻译文案拼写不一致
- 改了某个词，要在 3 个地方分别改
- 新增一个应用，又要从其他地方 copy 一份翻译文件

文案散落在各处，术语不一致，维护成本随应用数量线性增长。

## 解决方案：Monorepo 共享 Locale 包

核心思路：**把翻译文件从各个应用中抽取出来，放到一个专门的 `packages/locales` 包里**，作为单一事实来源（SSOT）。

```
packages/
└── locales/
    ├── src/
    │   ├── zh.ts    ← 中文（主要）
    │   ├── en.ts    ← 英文
    │   └── index.ts ← 统一导出
    └── package.json
```

### 翻译文件结构

使用 TypeScript 而非 JSON，可以获得类型推导和 IDE 补全：

```typescript
// packages/locales/src/zh.ts
export const zh = {
  common: {
    save: '保存',
    cancel: '取消',
    delete: '删除',
    edit: '编辑',
    published: '已发布',
    draft: '草稿',
    loading: '加载中...',
  },
  blog: {
    welcome: '探索技术，分享思考',
    readMore: '阅读全文',
    readingTime: '约 {minutes} 分钟',
  },
  dashboard: {
    title: '管理后台',
    new_post: '新建文章',
    blog_posts: '文章管理',
    sign_out: '退出登录',
  },
} as const

export type Locale = typeof zh
```

```typescript
// packages/locales/src/en.ts
import type { Locale } from './zh'

export const en: Locale = {
  common: {
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    published: 'Published',
    draft: 'Draft',
    loading: 'Loading...',
  },
  blog: {
    welcome: 'Explore technology, share thoughts',
    readMore: 'Read more',
    readingTime: 'About {minutes} min read',
  },
  dashboard: {
    title: 'Dashboard',
    new_post: 'New Post',
    blog_posts: 'Blog Posts',
    sign_out: 'Sign Out',
  },
}
```

`en` 的类型被约束为 `Locale`（即 `zh` 的结构），**确保两个语言文件的键名完全一致**。如果 `en.ts` 缺少某个键，TypeScript 会报错。

### 统一导出

```typescript
// packages/locales/src/index.ts
export { zh } from './zh'
export { en } from './en'
export type { Locale } from './zh'
```

```json
// packages/locales/package.json
{
  "name": "@starye/locales",
  "main": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  }
}
```

## 在各应用中消费

### Dashboard（Vue 3 + vue-i18n）

```typescript
// apps/dashboard/src/main.ts
import { createI18n } from 'vue-i18n'
import { en, zh } from '@starye/locales'

const i18n = createI18n({
  locale: localStorage.getItem('starye_i18n') || 'zh',
  fallbackLocale: 'zh',
  messages: { zh, en },
})

app.use(i18n)
```

```vue
<!-- 模板中直接使用 -->
<template>
  <button>{{ t('dashboard.new_post') }}</button>
</template>
```

### Blog（Nuxt 4 + @nuxtjs/i18n）

```typescript
// apps/blog/nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@nuxtjs/i18n'],
  i18n: {
    locales: [
      { code: 'zh', iso: 'zh-CN', name: '简体中文' },
      { code: 'en', iso: 'en-US', name: 'English' },
    ],
    defaultLocale: 'zh',
    strategy: 'no_prefix',
    vueI18n: './i18n.config.ts',
  },
})
```

```typescript
// apps/blog/i18n.config.ts
import { en, zh } from '@starye/locales'

export default defineI18nConfig(() => ({
  legacy: false,
  messages: { zh, en },
}))
```

使用时与 Dashboard 完全一致：`t('blog.welcome')`

## 语言切换持久化

Dashboard 的语言切换存到 `localStorage`，刷新后保持选择：

```typescript
// apps/dashboard/src/composables/useLocale.ts
import { useI18n } from 'vue-i18n'

const LOCALE_KEY = 'starye_i18n'

export function useLocale() {
  const { locale } = useI18n()

  function setLocale(lang: 'zh' | 'en') {
    locale.value = lang
    localStorage.setItem(LOCALE_KEY, lang)
  }

  return { locale, setLocale }
}
```

## 方案的局限性

### 不适合细粒度按需加载

当前方案会把所有语言的所有翻译打包进每个应用。对于小型个人项目，这完全没问题（整个 locale 包也就几 KB）。

但如果翻译文件很大，需要考虑按模块懒加载：

```typescript
// 懒加载方案（未采用）
const messages = {
  zh: () => import('@starye/locales/zh'),
  en: () => import('@starye/locales/en'),
}
```

### Nuxt optimizeDeps 配置

在 Nuxt 4 中，`@starye/locales` 需要加入 `optimizeDeps.exclude`，否则 Vite 的依赖预构建可能引起热更新问题：

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  vite: {
    optimizeDeps: {
      exclude: ['@starye/locales'],
    },
  },
})
```

## 经验总结

### Checklist：Monorepo i18n 最佳实践

- [ ] **翻译文件放到独立包**：避免各应用各自维护
- [ ] **使用 TypeScript**：利用类型推导确保多语言键名一致性
- [ ] **以主语言文件的类型约束其他语言**：`const en: typeof zh = { ... }` 防止遗漏
- [ ] **统一键名规范**：按功能模块分层（`common.xxx`、`blog.xxx`）
- [ ] **语言切换持久化**：存到 `localStorage` 或 Cookie

### 为什么不用 JSON？

JSON 文件简单，但没有类型推导——拼错一个键名，运行时才会发现。用 TypeScript `as const` 导出的对象，在消费端可以获得完整的键名自动补全，重命名时也能全局同步更新。
