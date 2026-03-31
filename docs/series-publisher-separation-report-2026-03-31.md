# 系列与厂商区分实施报告

**日期**: 2026-03-31
**变更**: integrate-seesaawiki-data-source
**任务**: 12.14 区分系列和厂商

## 问题背景

在前期测试中（任务 12.12.3）发现，JavBus 的"發行商"字段实际上是**系列/品牌名**，而非真实的公司名称。这导致：

1. **厂商爬虫失败率高**：系列名（如 SODSTAR, マジックミラー号）在 SeesaaWiki 上没有独立页面
2. **数据语义错误**：数据库中的 publisher 字段混杂了系列名和真实厂商名
3. **用户体验差**：前端显示的"厂商"实际是系列，导致信息不准确

## 解决方案

### 核心策略

区分 JavBus 页面上的三个字段：

| JavBus 字段 | 实际含义 | 用途 | 示例 |
|------------|---------|------|------|
| 發行商 | 系列/品牌名 | 保存到 `movie.series` | SODSTAR, マジックミラー号 |
| 系列 | 系统系列（较少） | 作为 series 备选 | 顔射メガ盛りMAX |
| 製作商 | 真实公司名 | 保存到 `movie.publisher` | SODクリエイト, プレステージ |

### 实施步骤

#### 1. 修改 JavBus 爬虫解析逻辑

**文件**: `packages/crawler/src/crawlers/javbus.ts`

**修改内容**:
```typescript
// 区分系列和厂商
const seriesName = infoMap['發行商:'] // 實際上是系列/品牌名
const systemSeries = infoMap['系列:'] // 系統定義的系列
const studioName = infoMap['製作商:'] // 真實的公司名

// 使用系列名（發行商）優先，其次是系列字段
const finalSeries = seriesName || systemSeries
// 使用製作商作為真實廠商，如果沒有則降級使用發行商
const finalPublisher = studioName || seriesName
```

**解析 URL**:
```typescript
// 解析厂商详情页 URL（區分系列和真實廠商）
let seriesUrl = '' // 發行商（系列）的 URL
let studioUrl = '' // 製作商（真實廠商）的 URL

const publisherEl = Array.from(document.querySelectorAll('.info p'))
  .find(el => el.textContent?.includes('發行商:'))
if (publisherEl) {
  const publisherLink = publisherEl.querySelector('a') as HTMLAnchorElement
  if (publisherLink) {
    seriesUrl = publisherLink.href || ''
  }
}

const studioEl = Array.from(document.querySelectorAll('.info p'))
  .find(el => el.textContent?.includes('製作商:'))
if (studioEl) {
  const studioLink = studioEl.querySelector('a') as HTMLAnchorElement
  if (studioLink) {
    studioUrl = studioLink.href || ''
  }
}
```

**返回数据结构**:
```typescript
return {
  // ... 其他字段
  series: finalSeries, // 系列名
  publisher: finalPublisher, // 真實廠商名
  publisherUrl: studioUrl || seriesUrl, // 優先使用製作商URL
  seriesUrl, // 系列URL（發行商）
  studioUrl, // 製作商URL
}
```

#### 2. 创建系列到厂商的映射表

**目的**: 建立系列名和其对应真实厂商的映射关系，便于：
- 数据分析和报告
- 前端展示系列所属厂商
- 未来可能的系列爬虫

**实现**:

在 `JavBusCrawler` 中添加映射收集逻辑：

```typescript
// 收集系列到厂商的映射（如果系列和厂商不同）
if (movieInfo.series && movieInfo.publisher && movieInfo.series !== movieInfo.publisher) {
  // 記錄系列名對應的廠商名（用於後續創建映射表）
  if (!this.seriesPublisherMap) {
    this.seriesPublisherMap = new Map()
  }
  this.seriesPublisherMap.set(movieInfo.series, movieInfo.publisher)
}
```

在同步完成后保存映射文件：

```typescript
// 保存系列到厂商的映射表
if (this.seriesPublisherMap && this.seriesPublisherMap.size > 0) {
  await this.saveSeriesPublisherMap()
}
```

**输出文件**: `.series-to-publisher-map.json`

#### 3. 更新 API 同步服务

**文件**: `apps/api/src/routes/movies/services/sync.service.ts`

**修改内容**:

在 `SyncMovieDataOptions` 接口中添加 `series` 字段：
```typescript
movies: Array<{
  // ... 其他字段
  series?: string // 系列名（通常来自"發行商"字段）
  publisher?: string // 真实厂商名（来自"製作商"字段）
}>
```

在数据解构和保存中添加 series 处理：
```typescript
const { series, publisher } = movieData

const moviePayload: Partial<Movie> = {
  // ... 其他字段
  series: series || null, // 系列名
  publisher: publisher || null, // 真实厂商名
}
```

#### 4. 更新类型定义

**文件**: `packages/crawler/src/lib/strategy.ts`

添加新字段到 `MovieInfo` 接口：
```typescript
export interface MovieInfo {
  // ... 其他字段

  // 新增：区分系列和厂商（2026-03-31）
  seriesUrl?: string // 發行商（系列）的 URL
  studioUrl?: string // 製作商（真實廠商）的 URL
}
```

## 验证结果

### 测试数据

运行快速测试爬取30部影片，结果：

#### 影片数据示例

| 番号 | 系列 (series) | 厂商 (publisher) |
|------|---------------|------------------|
| START-538 | SODSTAR | SODクリエイト |
| START-541 | SODSTAR | SODクリエイト |
| RCTD-727 | ROCKET | ロケット |
| ABF-227 | ABSOLUTELYFANTASIA | プレステージ |
| SDMM-228 | マジックミラー号 | SODクリエイト |
| MOGI-154 | もぎたて素人 | SODクリエイト |

#### 厂商数据（7个真实厂商）

| 厂商名 | Slug | Source ID |
|--------|------|-----------|
| SODクリエイト | ca | ca |
| プレステージ | 75 | 75 |
| ロケット | 3p9 | 3p9 |
| KANBi | 3hd | 3hd |
| TMA | 54 | 54 |
| ONEMORE | 3to | 3to |
| SEX MACHINE | 3jt | 3jt |

#### 系列映射表（16条映射）

从 `.series-to-publisher-map.json`:

```json
[
  { "series": "SODSTAR", "publisher": "SODクリエイト" },
  { "series": "ROCKET", "publisher": "ロケット" },
  { "series": "ABSOLUTELYFANTASIA", "publisher": "プレステージ" },
  { "series": "マジックミラー号", "publisher": "SODクリエイト" },
  { "series": "もぎたて素人", "publisher": "SODクリエイト" },
  { "series": "めばえ#18", "publisher": "SODクリエイト" },
  { "series": "SOD女子社員", "publisher": "SODクリエイト" },
  { "series": "本物人妻(旦那に内緒でAV体験)", "publisher": "SODクリエイト" }
  // ... 更多映射
]
```

### 关键指标

- ✅ **数据语义正确**: series 是系列名，publisher 是真实厂商
- ✅ **厂商数量优化**: 从之前的 10 个（含系列）减少到 7 个真实厂商
- ✅ **系列覆盖**: 30 部影片中，20 部有系列名（66.7%）
- ✅ **映射表完整**: 自动生成并持久化系列映射关系

## 影响范围

### 数据库 Schema

无需修改 - `movies` 表本身已有 `series` 字段，只是之前未被正确使用。

### 修改文件清单

1. `packages/crawler/src/crawlers/javbus.ts`
   - 修改字段解析逻辑
   - 添加 URL 解析逻辑
   - 添加系列映射收集
   - 添加映射表保存方法

2. `packages/crawler/src/lib/strategy.ts`
   - 添加 `seriesUrl` 和 `studioUrl` 字段到 `MovieInfo` 接口

3. `apps/api/src/routes/movies/services/sync.service.ts`
   - 在 `SyncMovieDataOptions` 接口添加 `series` 字段
   - 在数据处理中添加 series 保存逻辑

4. 新增文件: `.series-to-publisher-map.json`（映射表）

### 向后兼容性

- ✅ **完全向后兼容**: 如果"製作商"字段为空，自动降级使用"發行商"
- ✅ **增量更新**: 映射表会自动合并新映射，不覆盖已有数据
- ✅ **非破坏性**: 不影响已有数据，只影响新爬取的数据

## 后续建议

### 短期（立即执行）

1. **重新爬取影片数据**: 清空数据库，运行完整影片爬虫以应用新逻辑
2. **验证映射表**: 检查生成的映射表是否完整和准确

### 中期（1-2周内）

1. **优化厂商爬虫**: 现在可以基于真实厂商名进行 SeesaaWiki 爬取
2. **前端展示**: 在影片详情页同时展示系列和厂商信息
3. **数据统计**: 分析哪些系列最活跃、哪些厂商作品最多

### 长期（可选）

1. **系列独立管理**: 考虑创建独立的 `series` 表
2. **系列关系图**: 展示厂商 → 系列 → 影片的层级关系
3. **系列爬虫**: 为热门系列添加专门的 SeesaaWiki 爬虫

## 技术亮点

1. **语义准确性**: 正确区分系列和厂商，符合行业认知
2. **数据完整性**: 自动建立映射表，便于追溯和分析
3. **容错降级**: 当"製作商"缺失时自动降级到"發行商"
4. **增量更新**: 映射表支持增量合并，不会丢失已有映射

## 结论

✅ **任务完成**: 成功实现系列和厂商的区分，数据语义正确，映射表自动生成。

下一步: 重新运行完整影片爬虫（任务 12.13），以全面应用新逻辑。
