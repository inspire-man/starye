# Design: 构建 Comic & Movie 用户前端应用

## Context

当前项目已有完整的管理后台（Dashboard）和爬虫系统（Crawler），数据存储在 D1（SQLite），通过 Drizzle ORM 访问。现需构建面向终端用户的两个独立前端应用（Comic App 和 Movie App），满足以下约束：

- **技术栈统一**：Vue 3 + TypeScript + Vite，与 Dashboard 保持一致
- **部署环境**：Cloudflare Pages，通过 Gateway Worker 路由
- **内容隔离**：Comic 和 Movie 必须完全独立（法规要求）
- **R18 控制**：纯白名单模式，用户无法自主申请
- **认证方式**：复用现有 better-auth（GitHub OAuth2）
- **移动端优先**：响应式设计，确保移动端体验

## Goals / Non-Goals

**Goals:**
- 构建可用的 Comic 和 Movie 前端应用，支持内容浏览、搜索、进度同步
- 实现 R18 白名单管理和验证机制
- 提供良好的移动端和桌面端体验
- 确保内容隔离和访问控制的安全性

**Non-Goals:**
- 评论系统（未来扩展）
- 用户注册功能（仍使用 GitHub OAuth2）
- 推荐算法（初期使用简单排序）
- SEO 优化（初期不做服务端渲染）
- PWA 离线支持（未来扩展）

## Decisions

### 1. 应用架构：独立 SPA vs 单体多路由

**决策**：创建两个独立的 Vue 应用（`apps/comic` 和 `apps/movie`）

**理由**：
- ✅ **内容隔离**：独立应用天然隔离，降低交叉访问风险
- ✅ **部署灵活**：可独立部署、独立优化、独立缓存策略
- ✅ **代码清晰**：避免单体应用中的大量条件判断
- ❌ **代码重复**：需要共享组件库解决

**备选方案**：单体应用 + 多路由 + 权限控制
- ❌ 需要在每个路由层面判断内容类型
- ❌ 容易出现交叉引用的 bug

### 2. UI 组件复用：共享库 vs 各自实现

**决策**：阶段性策略
- **Phase 1**：在各自应用中实现组件（快速迭代）
- **Phase 2**：提取共享组件到 `packages/ui`（优化期）

**理由**：
- ✅ **快速启动**：避免过早抽象
- ✅ **灵活调整**：根据实际需求定型后再提取
- Phase 2 提取候选：Button, Card, Loading, Dialog, Input, Image（懒加载）

### 3. 阅读器实现：纵向滚动 vs 翻页

**决策**：Comic App 使用纵向滚动（Vertical Scroll）

**理由**：
- ✅ **移动端友好**：自然的滚动手势，无需额外适配
- ✅ **实现简单**：标准 DOM 滚动，无需动画库
- ✅ **用户习惯**：参考腾讯动漫、微信读书等主流产品
- ✅ **性能优化**：配合虚拟滚动（Intersection Observer）可优化长章节

**技术方案**：
```vue
<template>
  <div class="reader-container">
    <img
      v-for="(image, index) in chapter.images"
      :key="index"
      :src="image.url"
      :data-index="index"
      loading="lazy"
      @load="onImageLoad(index)"
    />
  </div>
</template>
```

**备选方案**：翻页模式（Pagination）
- 需要 Swiper 或自定义手势库
- 更适合桌面端

### 4. 播放器选型：iframe vs xgplayer vs video.js

**决策**：使用西瓜播放器（xgplayer）

**理由**：
- ✅ **功能丰富**：支持 HLS、FLV、MPEG-DASH、MP4
- ✅ **多源切换**：内置播放源管理，适合影片站场景
- ✅ **移动端优化**：原生支持触摸手势
- ✅ **文档完善**：字节跳动开源，社区活跃
- ✅ **兼容性好**：兼容到 IE11+（如需要）

**集成方案**：
```typescript
import Player from 'xgplayer'

const player = new Player({
  id: 'video-container',
  url: currentSource.url,
  poster: movie.coverUrl,
  playbackRate: [0.5, 0.75, 1, 1.25, 1.5, 2],
  lang: 'zh-cn'
})
```

**备选方案**：
- **iframe 直接嵌入**：最简单但功能受限，无法统一控制
- **video.js**：经典方案，但配置复杂度高

### 5. R18 验证机制：客户端 vs 服务端

**决策**：双重验证（客户端 + 服务端）

**服务端验证**（主要防线）：
```typescript
// API Middleware
export function requireR18Access() {
  return createMiddleware<AppEnv>(async (c, next) => {
    const user = c.get('user')
    if (!user?.isR18Verified) {
      return c.json({ error: 'R18 access denied' }, 403)
    }
    await next()
  })
}

// 所有 R18 内容的 API 都应用此中间件
app.get('/api/public/comics/:slug', requireR18Access(), ...)
```

**客户端验证**（UX 优化）：
- 在路由守卫中检查 `user.isR18Verified`
- R18 内容显示模糊封面 + 锁图标
- 点击后弹出提示："需要管理员授权访问 R18 内容"

**数据过滤**：
```typescript
// 所有公开 API 必须根据用户状态过滤
const comics = await db.select().from(comicsTable).where(
  and(
    user?.isR18Verified ? undefined : eq(comicsTable.isR18, false)
  )
)
```

### 6. 进度同步策略：实时 vs 批量 vs 防抖

**决策**：防抖更新（Debounced Update）

**理由**：
- ✅ **减少 API 调用**：避免每滚动一次就保存
- ✅ **用户体验**：无感知保存
- ✅ **服务器友好**：降低 D1 写入压力

**实现方案**：
```typescript
// 阅读器中使用防抖
const saveProgress = useDebounceFn(async (chapterId: string, page: number) => {
  await fetch('/api/public/progress/reading', {
    method: 'POST',
    body: JSON.stringify({ chapterId, page })
  })
}, 3000) // 3秒防抖

// 页面卸载前强制保存
onBeforeUnmount(() => {
  saveProgress.flush()
})
```

**数据库设计**：
```sql
CREATE TABLE reading_progress (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  chapterId TEXT NOT NULL,
  page INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  UNIQUE(userId, chapterId)
)

CREATE TABLE watching_progress (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  movieCode TEXT NOT NULL,
  progress INTEGER NOT NULL, -- 播放进度（秒）
  duration INTEGER, -- 总时长（秒）
  updatedAt INTEGER NOT NULL,
  UNIQUE(userId, movieCode)
)
```

### 7. API 设计：RESTful vs GraphQL

**决策**：RESTful API（保持现有风格）

**公开 API 路由规划**：
```
GET  /api/public/comics          # 漫画列表（分页、筛选、排序）
GET  /api/public/comics/:slug    # 漫画详情
GET  /api/public/comics/:slug/chapters/:chapterId # 章节详情（图片列表）

GET  /api/public/movies          # 影片列表
GET  /api/public/movies/:code    # 影片详情

POST /api/public/progress/reading   # 保存阅读进度
GET  /api/public/progress/reading   # 获取阅读进度
POST /api/public/progress/watching  # 保存观看进度
GET  /api/public/progress/watching  # 获取观看进度

GET  /api/admin/r18-whitelist        # 获取白名单用户列表
POST /api/admin/r18-whitelist/:userId # 添加用户到白名单
DELETE /api/admin/r18-whitelist/:userId # 移除白名单
```

**查询参数标准化**：
```typescript
interface ListQuery {
  page?: number      // 默认 1
  limit?: number     // 默认 20，最大 100
  sortBy?: string    // 排序字段
  sortOrder?: 'asc' | 'desc'
  search?: string    // 搜索关键词
  // Comic 专用
  category?: string
  status?: 'ongoing' | 'completed'
  // Movie 专用
  actor?: string
  publisher?: string
  genre?: string
}
```

### 8. 路由与部署：Gateway 路由策略

**决策**：在 Gateway Worker 中添加路由规则

**Gateway 配置**：
```typescript
// apps/gateway/src/index.ts
const routes = {
  '/api': 'api-worker',
  '/dashboard': 'dashboard-pages',
  '/comic': 'comic-pages',      // 新增
  '/movie': 'movie-pages',      // 新增
  '/auth': 'api-worker'
}
```

**应用路由设计**：
```
Comic App (apps/comic):
  /              # 首页
  /browse        # 浏览页（分类、筛选）
  /search        # 搜索页
  /comic/:slug   # 漫画详情
  /read/:slug/:chapterId # 阅读器
  /me            # 个人中心（书架、历史）

Movie App (apps/movie):
  /              # 首页
  /browse        # 浏览页（筛选）
  /search        # 高级搜索
  /movie/:code   # 影片详情
  /watch/:code   # 播放页
  /me            # 个人中心（收藏、历史）
```

### 9. 响应式设计：Tailwind Breakpoints

**决策**：使用 Tailwind CSS 断点 + 自定义媒体查询

**断点策略**：
```css
/* Tailwind 默认断点 */
sm: 640px   /* 平板竖屏 */
md: 768px   /* 平板横屏 */
lg: 1024px  /* 桌面 */
xl: 1280px  /* 大屏桌面 */

/* 移动端优先（Mobile First） */
- 默认样式为移动端
- 使用 md: lg: 前缀添加桌面样式
```

**关键适配点**：
- **首页**：移动端单列，桌面端多列网格
- **列表页**：移动端 2列，桌面端 4-6列
- **阅读器**：移动端全屏，桌面端居中限宽
- **播放器**：移动端全屏，桌面端 16:9 比例

## Risks / Trade-offs

### 风险 1: R18 内容泄露

**风险**：未授权用户通过 API 直接访问或绕过前端验证

**缓解措施**：
- ✅ 所有 R18 内容的 API 必须验证 `user.isR18Verified`
- ✅ 数据库查询层面过滤（`WHERE isR18 = false OR userId IN whitelist`）
- ✅ 定期审计 API 访问日志（利用现有 audit_logs 表）

### 风险 2: 图片加载性能

**风险**：漫画章节可能有上百张图片，影响加载速度

**缓解措施**：
- ✅ 使用 `loading="lazy"` 原生懒加载
- ✅ 图片预加载前后 3 张（Intersection Observer）
- ✅ R2 配置 CDN 缓存（Cache-Control: max-age=31536000）
- 📋 后期考虑：WebP/AVIF 格式转换、缩略图生成

### 风险 3: 视频源失效

**风险**：Movie 播放源可能失效（外部链接）

**缓解措施**：
- ✅ 支持多播放源切换（xgplayer 内置）
- ✅ 前端自动检测失效源并提示切换
- ✅ 管理后台提供播放源测试功能（已有 Player Management）
- 📋 考虑：定期自动检测播放源可用性（Crawler 扩展）

### 风险 4: 进度数据丢失

**风险**：用户清除 Cookie 或跨设备访问时进度丢失

**缓解措施**：
- ✅ 进度存储在服务端（D1），通过 userId 关联
- ✅ 未登录用户使用 localStorage 临时存储
- ✅ 登录后自动同步本地进度到云端

### 权衡 1: 初期不做 SSR

**权衡**：SPA 应用 SEO 较差，但简化开发

**理由**：
- 项目初期重点是功能可用性
- 内容站点不需要搜索引擎收录（私有站点）
- Cloudflare Pages 支持预渲染，未来可升级

### 权衡 2: 不共享 UI 组件库

**权衡**：Phase 1 会有代码重复，但加快迭代速度

**理由**：
- 过早抽象会增加开发时间
- 两个应用的 UI 风格可能不完全一致
- 等稳定后再提取共享组件

## Migration Plan

### 数据库迁移

**新增表**：
```sql
-- 1. 扩展 user 表
ALTER TABLE user ADD COLUMN isR18Verified INTEGER DEFAULT 0;

-- 2. 创建进度表
CREATE TABLE reading_progress (...);
CREATE TABLE watching_progress (...);
CREATE INDEX idx_reading_progress_user ON reading_progress(userId);
CREATE INDEX idx_watching_progress_user ON watching_progress(userId);
```

**迁移步骤**：
1. 在 `packages/db/src/schema.ts` 中定义新表和字段
2. 运行 `drizzle-kit generate:sqlite` 生成迁移文件
3. 在本地测试迁移：`wrangler d1 execute starye-db-dev --local --file=./migrations/xxx.sql`
4. 在生产环境应用迁移：`wrangler d1 execute starye-db-prod --file=./migrations/xxx.sql`

### 部署顺序

1. **后端 API**：先部署公开 API 和白名单管理 API
2. **Gateway**：更新路由配置
3. **前端应用**：Comic App 和 Movie App 部署到 Cloudflare Pages
4. **Dashboard**：添加 R18 白名单管理界面

**回滚策略**：
- API 向后兼容，新增端点不影响现有功能
- Gateway 路由可快速切换或禁用
- 前端应用独立部署，可独立回滚

## Open Questions

1. **图片存储策略**：
   - 当前图片是直接存储源站 URL 还是已同步到 R2？
   - 如果是源站 URL，是否需要反向代理避免防盗链？

2. **搜索功能实现**：
   - 使用 SQLite LIKE 查询（简单但性能有限）？
   - 还是引入全文搜索（如 Cloudflare Workers AI 或外部服务）？

3. **用户反馈机制**：
   - 播放源失效、图片加载失败等问题，用户如何反馈？
   - 是否需要简单的"报告问题"按钮？

4. **匿名用户体验**：
   - 未登录用户能否浏览非 R18 内容？
   - 还是强制登录？

5. **移动端 PWA**：
   - 是否需要 PWA 支持（添加到主屏幕、离线缓存）？
   - 如果需要，优先级如何？
