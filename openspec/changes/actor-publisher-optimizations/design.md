# 女优/厂商功能后续优化 - 设计文档

## 0. 后台管理 UI 增强设计

### 0.1 表格列设计

#### 女优管理表格

```
┌──┬──────┬──────────────┬────────┬───────────────┬────────┬─────────────────────┐
│✓ │ 头像 │ 名称          │ 作品数 │ 爬取状态      │ 国籍   │ 创建时间            │
├──┼──────┼──────────────┼────────┼───────────────┼────────┼─────────────────────┤
│☐ │ [👤] │ 波多野结衣    │  247   │ ✅ 已完成     │ 日本   │ 2026-01-15 14:23:18 │
│☐ │ [👤] │ 三上悠亚      │  189   │ ✅ 已完成     │ 日本   │ 2026-01-15 14:25:42 │
│☐ │ [👤] │ 明日花绮罗    │  156   │ ⚠️ 待爬取     │ 日本   │ 2026-03-20 09:12:05 │
│☐ │ [?]  │ 未知演员A     │   12   │ ❌ 失败(3)    │   -    │ 2026-03-21 08:30:11 │
│☐ │ [?]  │ 临时演员B     │    3   │ 🔗 无链接     │   -    │ 2026-03-21 10:15:33 │
└──┴──────┴──────────────┴────────┴───────────────┴────────┴─────────────────────┘
```

**列配置**：
```typescript
const tableColumns = [
  { key: 'select', label: '选择', sortable: false, width: '40px' },
  { key: 'avatar', label: '头像', sortable: false, width: '60px' },
  { key: 'name', label: '名称', sortable: true, width: '200px' },
  { key: 'movieCount', label: '作品数', sortable: true, width: '80px' },
  { key: 'crawlStatus', label: '爬取状态', sortable: false, width: '120px' },
  { key: 'nationality', label: '国籍', sortable: false, width: '80px' },
  { key: 'createdAt', label: '创建时间', sortable: true, width: '150px' },
]
```

#### 厂商管理表格

```
┌──────────┬──────────────┬────────┬───────────────┬────────┬─────────────────────┐
│   Logo   │ 名称          │ 作品数 │ 爬取状态      │ 国家   │ 创建时间            │
├──────────┼──────────────┼────────┼───────────────┼────────┼─────────────────────┤
│  [📷]    │ SOD Create   │  523   │ ✅ 已完成     │ 日本   │ 2025-12-10 08:15:22 │
│  [📷]    │ S1           │  498   │ ✅ 已完成     │ 日本   │ 2025-12-10 08:16:33 │
│  [?]     │ 临时厂商A    │   15   │ ⚠️ 待爬取     │   -    │ 2026-03-20 11:22:45 │
└──────────┴──────────────┴────────┴───────────────┴────────┴─────────────────────┘
```

### 0.2 爬取状态 Tag 组件设计

#### 组件结构

```vue
<template>
  <span 
    class="crawl-status-tag"
    :class="statusClass"
    :title="tooltip"
  >
    <span class="status-icon">{{ icon }}</span>
    <span class="status-text">{{ text }}</span>
  </span>
</template>

<script setup lang="ts">
interface Props {
  hasDetailsCrawled: boolean
  sourceUrl?: string | null
  crawlFailureCount?: number
}

const props = defineProps<Props>()

const statusInfo = computed(() => {
  if (props.hasDetailsCrawled) {
    return {
      icon: '✅',
      text: '已完成',
      class: 'status-complete',
      tooltip: '详情已爬取完成'
    }
  }
  
  if (props.crawlFailureCount && props.crawlFailureCount > 0) {
    return {
      icon: '❌',
      text: `失败(${props.crawlFailureCount})`,
      class: 'status-failed',
      tooltip: `已尝试 ${props.crawlFailureCount} 次失败，需要人工检查`
    }
  }
  
  if (!props.sourceUrl) {
    return {
      icon: '🔗',
      text: '无链接',
      class: 'status-no-link',
      tooltip: '没有详情页 URL，无法自动爬取'
    }
  }
  
  return {
    icon: '⚠️',
    text: '待爬取',
    class: 'status-pending',
    tooltip: '详情待补全，下次爬虫运行时会处理'
  }
})
</script>
```

#### 样式规范

```css
.crawl-status-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid;
  cursor: help;
}

/* 已完成 */
.status-complete {
  background: #dcfce7;
  color: #166534;
  border-color: #86efac;
}

/* 待爬取 */
.status-pending {
  background: #fef3c7;
  color: #92400e;
  border-color: #fcd34d;
}

/* 失败 */
.status-failed {
  background: #fee2e2;
  color: #991b1b;
  border-color: #fca5a5;
}

/* 无链接 */
.status-no-link {
  background: #f3f4f6;
  color: #6b7280;
  border-color: #d1d5db;
}
```

### 0.3 筛选器改进设计

#### 原筛选器（女优）

```vue
<!-- 当前实现 -->
<div class="filter-bar">
  <input v-model="filters.search" type="text" placeholder="搜索演员名称..." />
  <label class="filter-checkbox">
    <input v-model="filters.onlyPending" type="checkbox" />
    <span>仅显示待爬取详情</span>
  </label>
</div>
```

#### 新筛选器设计

```vue
<div class="filter-bar">
  <!-- 搜索框 -->
  <input 
    v-model="filters.search" 
    type="text" 
    placeholder="搜索演员名称..." 
    class="search-input"
  />
  
  <!-- 爬取状态筛选 -->
  <select v-model="filters.crawlStatus" class="filter-select" @change="loadActors">
    <option value="">全部状态</option>
    <option value="complete">✅ 已完成</option>
    <option value="pending">⚠️ 待爬取</option>
    <option value="failed">❌ 爬取失败</option>
    <option value="no-link">🔗 无链接</option>
  </select>
  
  <!-- 国籍筛选 -->
  <select v-model="filters.nationality" class="filter-select" @change="loadActors">
    <option value="">全部国籍</option>
    <option value="日本">🇯🇵 日本</option>
    <option value="韩国">🇰🇷 韩国</option>
    <option value="中国">🇨🇳 中国</option>
    <option value="美国">🇺🇸 美国</option>
    <option value="other">🌏 其他</option>
  </select>
  
  <div class="filter-info">
    共 {{ totalItems }} 个演员
  </div>
</div>
```

#### 筛选器布局

```
┌──────────────────────────────────────────────────────────────┐
│  [搜索框..................] [爬取状态 ▾] [国籍 ▾] 共 1,234 个 │
└──────────────────────────────────────────────────────────────┘
    flex: 1                    150px       120px    自动
```

### 0.4 API 增强

#### 查询参数支持

```typescript
// GET /api/admin/actors
interface ActorQueryParams {
  page: number
  limit: number
  search?: string
  
  // 新增筛选参数
  crawlStatus?: 'complete' | 'pending' | 'failed' | 'no-link'
  nationality?: string
  
  // 原有参数（保留）
  onlyPending?: 'true' | 'false' // 向后兼容
}
```

#### 爬取状态逻辑映射

```typescript
function buildCrawlStatusFilter(crawlStatus: string) {
  switch (crawlStatus) {
    case 'complete':
      return eq(actors.hasDetailsCrawled, true)
    
    case 'pending':
      return and(
        eq(actors.hasDetailsCrawled, false),
        eq(actors.crawlFailureCount, 0),
        isNotNull(actors.sourceUrl)
      )
    
    case 'failed':
      return and(
        eq(actors.hasDetailsCrawled, false),
        gt(actors.crawlFailureCount, 0)
      )
    
    case 'no-link':
      return and(
        eq(actors.hasDetailsCrawled, false),
        isNull(actors.sourceUrl)
      )
    
    default:
      return undefined
  }
}
```

### 0.5 时间格式化

#### 工具函数

```typescript
// apps/dashboard/src/lib/date-utils.ts

export function formatDateTime(timestamp: number | null | undefined): string {
  if (!timestamp) return '-'
  
  const date = new Date(timestamp * 1000)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
  // 输出：2026-03-21 14:23:18
}
```

### 0.6 响应式设计考虑

#### 不同屏幕宽度的适配

```
宽度 >= 1600px（超宽屏）：
  ┌─────────────────────────────────────────────────┐
  │  所有列正常显示，间距舒适                        │
  └─────────────────────────────────────────────────┘

宽度 >= 1280px（标准屏）：
  ┌─────────────────────────────────────────────────┐
  │  所有列正常显示，间距紧凑                        │
  └─────────────────────────────────────────────────┘

宽度 < 1280px（小屏）：
  ┌─────────────────────────────────────────────────┐
  │  隐藏创建时间列，保留核心列                      │
  │  或提供水平滚动                                  │
  └─────────────────────────────────────────────────┘

建议：1280px 为最小支持宽度（管理端通常在桌面端使用）
```

---

## 1. 缓存优化设计

### 1.1 Cloudflare KV 架构

```
请求流程：

用户请求 → Workers API
                │
                ├─→ 检查 KV Cache
                │     │
                │     ├─ 命中 → 直接返回
                │     │
                │     └─ 未命中 ↓
                │
                └─→ 查询 D1 数据库
                      │
                      └─→ 写入 KV Cache（设置 TTL）
                            │
                            └─→ 返回给用户
```

### 1.2 缓存键设计

```typescript
// 缓存键命名规范
const cacheKeys = {
  actorList: (page: number, limit: number, filters: string) => 
    `actors:list:${page}:${limit}:${filters}`,
  
  actorDetail: (id: string) => 
    `actors:detail:${id}`,
  
  publisherList: (page: number, limit: number, filters: string) =>
    `publishers:list:${page}:${limit}:${filters}`,
  
  publisherDetail: (id: string) =>
    `publishers:detail:${id}`,
}

// TTL 配置
const cacheTTL = {
  list: 3600,      // 列表页：1 小时
  detail: 7200,    // 详情页：2 小时
  stats: 1800,     // 统计数据：30 分钟
}
```

### 1.3 缓存失效策略

```
触发条件：

1. 数据变更时主动失效
   └─ 更新女优/厂商 → 清除对应详情缓存
   └─ 删除女优/厂商 → 清除详情 + 列表缓存

2. 定时自动失效
   └─ TTL 过期后自动清除

3. 手动清除
   └─ 提供 API：POST /api/admin/cache/clear
```

---

## 2. 女优别名管理设计

### 2.1 数据结构

```typescript
// actors.aliases 字段（JSON）
{
  "aliases": [
    {
      "name": "Hatano Yui",      // 罗马音
      "language": "en",
      "isPrimary": false
    },
    {
      "name": "はたのゆい",       // 平假名
      "language": "ja",
      "isPrimary": false
    }
  ]
}
```

### 2.2 UI 设计

```
┌─────────────────────────────────────────────────┐
│  女优详情编辑 - 波多野结衣                       │
├─────────────────────────────────────────────────┤
│                                                  │
│  【别名管理】                                    │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │ 波多野结衣 [主名称]                       │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │ Hatano Yui         [en]           [删除]  │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │ はたのゆい         [ja]           [删除]  │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  [+ 添加别名]                                    │
│                                                  │
└─────────────────────────────────────────────────┘
```

---

## 3. 女优关系图谱设计

### 3.1 数据分析逻辑

```sql
-- 统计女优合作频率
WITH actor_pairs AS (
  SELECT 
    a1.actorId as actor1,
    a2.actorId as actor2,
    COUNT(*) as collaboration_count
  FROM movie_actors a1
  JOIN movie_actors a2 
    ON a1.movieId = a2.movieId 
    AND a1.actorId < a2.actorId
  GROUP BY a1.actorId, a2.actorId
  HAVING collaboration_count >= 3
)
SELECT * FROM actor_pairs
ORDER BY collaboration_count DESC
LIMIT 50
```

### 3.2 图谱可视化

```
     波多野结衣 (247作品)
           │
    ┌──────┼──────┐
    │      │      │
   12作品  8作品  5作品
    │      │      │
 三上悠亚  桥本有菜  明日花绮罗

节点大小 = 作品数量
边的粗细 = 合作次数
```

---

## 4. 用户收藏功能设计

### 4.1 数据模型

```typescript
// user_favorites 表
{
  id: string (uuid)
  userId: string (FK → users.id)
  entityType: 'actor' | 'publisher' | 'movie'
  entityId: string
  createdAt: timestamp
  
  // 复合唯一索引
  unique(userId, entityType, entityId)
}
```

### 4.2 UI 交互

```
女优卡片：
┌─────────────────────┐
│      [头像]         │
│                     │
│    波多野结衣        │
│    247 作品         │
│                     │
│  [♡ 收藏] 1.2k 收藏 │  ← 未收藏状态
└─────────────────────┘

点击后：
┌─────────────────────┐
│      [头像]         │
│                     │
│    波多野结衣        │
│    247 作品         │
│                     │
│  [♥ 已收藏] 1.2k    │  ← 已收藏状态（红心）
└─────────────────────┘
```

---

## 5. 爬虫代理池设计

### 5.1 配置结构

```typescript
// .env 配置
PROXY_POOL=proxy1.com:8080,proxy2.com:8080,proxy3.com:8080
PROXY_USERNAME=user
PROXY_PASSWORD=pass
PROXY_ROTATION_STRATEGY=round-robin | on-failure

// 代理池类
class ProxyPool {
  private proxies: Proxy[]
  private currentIndex: number
  private failureCount: Map<string, number>
  
  constructor(proxyList: string[])
  
  getNext(): Proxy                    // 获取下一个代理
  markFailure(proxy: Proxy): void     // 标记失败
  markSuccess(proxy: Proxy): void     // 标记成功
  getHealthyProxies(): Proxy[]        // 获取健康代理列表
}
```

### 5.2 健康检查机制

```
定时检查（每 5 分钟）：
  │
  ├─→ 测试每个代理（访问测试 URL）
  │     │
  │     ├─ 成功 → 重置失败计数
  │     └─ 失败 → 失败计数++
  │
  └─→ 失败 >= 3 次 → 标记为不健康
```

---

## 6. 数据清理脚本设计

### 6.1 清理策略

```
安全清理流程：

1. 验证关联表数据完整性
   └─ 检查 movie_actors 和 movie_publishers 记录数量
   └─ 对比 movies.actors/publisher 字段数据量

2. 生成清理预览报告
   └─ 显示将清理的字段和影响的记录数

3. 执行清理（需人工确认）
   └─ 将 movies.actors 和 movies.publisher 设为 NULL
   └─ 保留 3 个月内的数据作为缓冲

4. 验证清理结果
   └─ 再次检查关联表数据完整性
   └─ 生成清理报告
```

---

## 📊 总体设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 空值显示 | "-" | 简洁，一致性 MUST |
| 爬取状态筛选器 | 下拉菜单 | 支持多种状态，更灵活 MUST |
| 国籍筛选器 | 下拉菜单（动态加载） | 常见国籍有限，下拉更友好 MUST |
| 时间格式 | `YYYY-MM-DD HH:mm:ss` | 精确，便于排查问题 MUST |
| Tag 样式 | 图标+文字+颜色 | 信息丰富，一眼识别 MUST |
| 表格最小宽度 | 1280px | 管理端主要在桌面使用 SHALL |
| 头像占位符 | 保持首字符方案 | 已实现良好 SHALL |

---

## 🎯 实现优先级

### 阶段 1: 核心 UI 增强（P0）
- 0.1-0.5 后台管理表格和筛选器改进
- 预计影响：5 个文件，约 300 行代码

### 阶段 2: 性能优化（P0）
- 1.1-1.5 Cloudflare KV 缓存
- 预计影响：API 响应时间从 200ms → 50ms

### 阶段 3: 数据管理（P1）
- 2.x 别名管理
- 6.x 数据清理

### 阶段 4: 增强功能（P2-P3）
- 3.x 关系图谱
- 4.x 用户收藏
- 5.x 代理池

---

这个设计文档捕获了我们讨论的所有决策。准备好开始实施了吗？还是想继续探讨某个具体部分？
