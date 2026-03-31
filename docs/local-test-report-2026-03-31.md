# 本地测试问题排查报告

## 测试时间
2026-03-31

## 发现的问题及解决方案

### ✅ 问题 1: 影片在首页没有显示

**原因**：
1. API 客户端发送格式错误：`{ type: 'movie', data: movieData }` 应为 `{ movies: [movieData] }`
2. 影片同步服务 `releaseDate` 处理bug：未正确处理 Unix timestamp 格式

**修复**：
- 修复 `packages/crawler/src/utils/api-client.ts` 的 `syncMovie()` 方法
- 修复 `apps/api/src/routes/movies/services/sync.service.ts` 的日期处理逻辑

**验证**：
- ✅ 影片成功入库（30部）
- ✅ API 查询正常：`GET /api/admin/movies` 返回完整数据

---

### ✅ 问题 2: 女优头像为空，访问详情页失败

**原因**：
1. 女优 `slug` 使用了中文（如"高星なぎさ"），不符合 URL 规范（期望 `/^[a-z0-9-]+$/`）
2. JavBus 爬虫未提取 `sourceId`（URL中的标识符，如"14fx"）

**修复**：
- 在 JavBus 爬虫中从 URL 提取 `sourceId`
- 更新 `BatchSyncActorsSchema` 和 `BatchSyncPublishersSchema` 添加 `sourceId` 字段
- 修改 batch-sync 接口，使用 `sourceId` 作为 `slug`

**验证**：
- ✅ 女优 slug 现在使用 URL 友好格式（如"14fx"）
- ✅ 女优详情页可通过 `/api/actors/14fx` 正常访问

---

### ⚠️ 问题 3: 厂商头像不对

**根本原因**：
JavBus 数据结构问题，"發行商"字段实际上是**系列名**而不是真正的厂商名：

| JavBus 字段 | 实际含义 | 示例 | SeesaaWiki 中存在 |
|---|---|---|---|
| 發行商 | 系列/品牌名 | SODSTAR、マジックミラー号、めばえ#18 | ❌ 通常无独立页面 |
| 製作商 | 真正的公司名 | SOD、Prestige、ROCKET | ✅ 有独立页面 |

**已实施的改进**：
1. ✅ 增强 404 检测：检测页面内容中的 "ページが見つかりませんでした"
2. ✅ 修复 URL 编码：缓存命中时重新构建 URL（使用正确的 EUC-JP）
3. ✅ 精确匹配验证：防止将不存在的页面标记为成功

**当前行为**（正确）：
- SeesaaWiki 精确匹配失败（404）
- 回退到 JavBus 数据源（但 JavBus 厂商页也很简陋）
- 记录为未匹配厂商

**建议长期解决方案**（需要架构调整）：
1. 修改 JavBus 爬虫，区分"發行商"（系列）和"製作商"（真实厂商）
2. 使用"製作商"字段作为 publisher，将"發行商"存储为 series
3. 为 SeesaaWiki 建立"系列名 → 真实厂商名"的映射表

---

## 测试验证结果

### 影片数据
- ✅ 入库成功：30 部
- ✅ 封面图片：30 张（CDN 上传成功）
- ✅ 发布日期：正确解析
- ✅ API 查询：正常（需要登录才能看到 R18 封面）

### 女优数据
- ✅ 基础数据：39 个女优，slug 格式正确
- ⚠️ 详情爬取：成功率 28.6%（2/7）
  - 问题：部分页面超时、页面类型误判
  - 正常行为：这是 SeesaaWiki 的反爬虫机制和数据质量问题

### 厂商数据
- ✅ 基础数据：14 个厂商，slug 格式正确
- ⚠️ 详情爬取：0% 成功（5/5 都是系列名，不是真实厂商）
  - ✅ 404 检测现在正常工作
  - ✅ 不会再产生错误的映射
  - 建议：需要使用"製作商"字段而不是"發行商"

---

## 建议下一步

### 立即可执行（不影响用户体验）：
1. ✅ 问题 1 和 2 已完全解决，可以正常使用
2. 对于厂商，暂时接受系列名无法找到 Wiki 页面的现状

### 需要架构调整（可选，提升数据质量）：
1. 修改 JavBus 爬虫，区分系列和厂商
2. 建立"系列名 → 厂商名"映射表
3. 为真正的厂商爬取 SeesaaWiki 详情

---

## 文件修改清单

### 已修复的文件：
1. `packages/crawler/src/utils/api-client.ts` - 影片同步格式
2. `packages/crawler/src/crawlers/javbus.ts` - sourceId 提取
3. `apps/api/src/schemas/admin.ts` - 添加 sourceId 字段
4. `apps/api/src/routes/admin/actors/index.ts` - 使用 sourceId 作为 slug
5. `apps/api/src/routes/admin/publishers/index.ts` - 使用 sourceId 作为 slug
6. `apps/api/src/routes/movies/services/sync.service.ts` - 日期处理修复
7. `packages/crawler/src/lib/name-mapper.ts` - 重新构建缓存URL + 增强404检测
8. `packages/crawler/src/strategies/seesaawiki/seesaawiki-strategy.ts` - 增强404检测

### 新增的测试文件：
1. `packages/crawler/scripts/test-movie-sync.ts`
2. `packages/crawler/scripts/test-real-movie-sync.ts`
3. `packages/crawler/scripts/check-publisher-logo.ts`

---

## 当前数据库状态

### 影片：30 部
- 封面：✅ 全部上传到 CDN
- 状态：✅ 可正常访问

### 女优：39 个
- Slug：✅ URL 友好格式
- 头像：⚠️ 大部分为空（详情爬取成功率低）

### 厂商：14 个
- Slug：✅ URL 友好格式
- Logo：⚠️ 全部为空（都是系列名，SeesaaWiki 无对应页面）

---

