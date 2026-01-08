# Starye 开发日志 (Development Log)

本文档记录 **Starye** 项目开发过程中的技术决策、踩坑记录与灵感碎片。旨在为未来的技术博客积累素材。

---

## 2026-01-08: 爬虫架构重构与测试体系搭建

### 🎯 目标
解决爬虫脚本难以调试、无法进行单元测试的问题，并建立项目级的自动化测试标准。

### 🛠️ 技术挑战 (Pain Points)
1.  **Puppeteer 的黑盒效应**: 之前的爬虫逻辑全部封装在 `page.evaluate(() => { ... })` 中。这部分代码在浏览器沙箱中运行，导致：
    *   IDE 无法调试（断点无效）。
    *   无法使用外部定义的 TypeScript 接口和工具函数。
    *   出错信息被序列化，丢失堆栈细节。
2.  **测试依赖网络**: 验证解析逻辑必须启动 Puppeteer 并访问真实网站，速度慢且容易因网络波动失败。
3.  **Monorepo 依赖管理**: 需要在多包环境下统一测试配置。

### 💡 解决方案 (The Fix)

#### 1. 逻辑解耦 (Decoupling)
将 "获取 HTML" 和 "解析 HTML" 彻底分离：
- **Before**: Browser (Fetch + Parse) -> Data
- **After**: Browser (Fetch Only) -> HTML String -> Node.js (HappyDOM + Pure Parser) -> Data

**代码演进**:
```typescript
// 🔴 Before: 逻辑硬编码在 evaluate 中
await page.evaluate(() => {
  return document.querySelector('.title').textContent;
});

// 🟢 After: 纯函数解析
// site-parser.ts
export function parse(doc: Document) {
  return doc.querySelector('.title').textContent;
}

// site-strategy.ts
const html = await page.content();
const doc = new Window().document;
doc.write(html);
return parse(doc);
```

#### 2. 引入 HappyDOM
选择 `happy-dom` 而不是 `jsdom`，因为它更轻量、速度更快，且 API 足以应对爬虫的 DOM 解析需求。这使得我们可以在 Node.js 环境中模拟浏览器 DOM，直接运行 Parser 代码。

#### 3. 建立测试金字塔
- **Unit Test (P0)**: 使用 `vitest` + `Fixture (本地 HTML)` 测试 Parser 逻辑。无需联网，毫秒级运行。
- **Integration Test (P1)**: (待办) 使用内存数据库测试 API 数据入库逻辑。

### 📝 博客灵感 (Blog Ideas)
- **标题**: 《拒绝 Puppeteer 黑盒：如何编写可测试、可调试的爬虫代码》
- **关键词**: Web Scraping, Testing, Clean Architecture, HappyDOM
- **大纲**:
    1. 为什么 `page.evaluate` 是维护噩梦？
    2. 依赖倒置：让解析逻辑不依赖 Puppeteer。
    3. 实战：使用 Vitest 和 Fixture 编写离线爬虫测试。
    4. 性能权衡：序列化 HTML 的开销 vs 开发体验的提升。

---

## 2026-01-08: D1 数据库迁移踩坑 (The Missing Migrations)

### 🚨 事故现场
在部署爬虫新逻辑后，同步漫画数据时 API 频繁报错 `500 Internal Server Error`。
日志详情：
```json
{
  "error": "Database Error: Failed query: insert into \"comic\" ... values ...",
  "details": "SqliteError: no such column: is_r18"
}
```

### 🧐 根因分析 (Root Cause)
1.  **Schema 变更**: 我们在代码库中更新了 `drizzle schema`，增加了 `is_r18` 和 `status` 字段，并生成了 migration 文件 (`0002_xxx.sql`)。
2.  **部署脱节**: 代码部署到了 Cloudflare Workers，API 开始尝试写入新字段。
3.  **Migration 缺失**: 远程 D1 数据库**并没有自动应用**这些变更。Worker 代码是最新的，但数据库结构还停留在旧版本。

### ✅ 解决方案 (Resolution)
必须显式运行命令将迁移应用到远程数据库：
```powershell
pnpm --filter api exec wrangler d1 migrations apply starye-db --remote
```

### 🧠 经验总结 (Lesson Learned)
*   **Infrastructure as Code != Auto Sync**: 代码里的 SQL 文件存在不代表数据库已经变更。
*   **Pipeline Checklist**: 在 CI/CD 流程中，`deploy` 之前必须包含 `db:migrate` 步骤（或者在开发流程中严格执行）。
*   **Better Errors**: 应该捕获 SQLite 错误并返回更明确的 400 Bad Request 或 500 错误码，指明 "Database schema mismatch"。

---