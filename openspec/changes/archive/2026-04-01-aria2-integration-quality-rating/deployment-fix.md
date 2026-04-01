# 部署错误修复记录

## 错误日期
2026-04-01

## 部署环境
- Cloudflare Workers (API)
- Cloudflare Pages (前端)

## 修复历史

### 第二轮修复 (Commit: 5f113fd)

**错误**：全局作用域使用定时器
```
Uncaught Error: Disallowed operation called within global scope. 
Asynchronous I/O (ex: fetch() or connect()), setting a timeout, and generating random values are not allowed within global scope.
  at null.<anonymous> (file:///...apps/api/src/utils/cache.ts:22:28) in MemoryCache
  at null.<anonymous> (file:///...apps/api/src/utils/cache.ts:111:25)
```

**原因**：
- `MemoryCache` 构造函数中使用了 `setInterval` 创建定时清理任务
- 在全局作用域 `export const apiCache = new MemoryCache()` 实例化，触发定时器创建
- Cloudflare Workers 不允许在全局作用域使用 `setInterval`、`setTimeout` 等异步操作

**修复方案**：惰性清理策略
```typescript
// 修改前
class MemoryCache {
  private cleanupInterval: any
  
  constructor() {
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 60 * 1000)
  }
  
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
  }
}

// 修改后
class MemoryCache {
  private lastCleanup = Date.now()
  private cleanupThreshold = 60 * 1000 // 每分钟触发一次清理
  
  get<T>(key: string): T | null {
    // 惰性清理：定期触发清理操作
    const now = Date.now()
    if (now - this.lastCleanup > this.cleanupThreshold) {
      this.cleanup()
      this.lastCleanup = now
    }
    // ... 其余逻辑
  }
  
  destroy() {
    this.clear()
  }
}
```

**优点**：
- 不依赖定时器，避免全局作用域异步操作
- 在实际访问缓存时才清理，更高效
- 符合 Cloudflare Workers 的执行模型（请求驱动）

---

### 第一轮修复 (Commit: 1eb85ce)

## 错误详情

### 1. Cloudflare Workers 部署失败

**错误信息**：
```
Uncaught ReferenceError: process is not defined
  at null.<anonymous> (file:///home/runner/work/starye/starye/apps/api/src/utils/featureFlags.ts:51:33) in loadFlagsFromEnv
  at null.<anonymous> (file:///home/runner/work/starye/starye/apps/api/src/utils/featureFlags.ts:71:20)
```

**原因分析**：
- Cloudflare Workers 运行时环境不支持 Node.js 的 `process.env`
- `featureFlags.ts` 中直接访问 `process.env` 导致运行时错误

**修复方案**：
```typescript
// 修改前
for (const key of Object.keys(process.env || {})) {
  if (key.startsWith('FEATURE_FLAG_')) {
    const value = process.env[key]
    // ...
  }
}

// 修改后
function loadFlagsFromEnv(env?: Record<string, string>): Record<string, FeatureFlag> {
  const flags = { ...defaultFlags }
  
  // 如果没有提供环境变量，直接返回默认配置
  if (!env) {
    return flags
  }
  
  // 从环境变量读取配置
  for (const key of Object.keys(env)) {
    if (key.startsWith('FEATURE_FLAG_')) {
      const value = env[key]
      // ...
    }
  }
  
  return flags
}
```

**说明**：
- 默认情况下所有功能标志都启用
- 可以通过 Hono 的 context 传递环境变量（未来扩展）
- 或通过 wrangler.toml 的 `[vars]` 配置环境变量

### 2. 前端构建 TypeScript 错误

**错误 2.1**：`aria2PerfTest.ts` - 未使用的参数
```
error TS6133: 'config' is declared but its value is never read.
```

**修复**：
```typescript
// 修改前
export async function testWebSocketReconnect(config: Aria2Config)

// 修改后
export async function testWebSocketReconnect(_config: Aria2Config)
```

---

**错误 2.2**：`playbackSources.ts` - 类型不匹配
```
error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string | null'.
```

**修复**：
```typescript
// 修改前
const autoScore = calculateAutoScore(
  source.quality,
  extractFileSize(source.sourceName),
  source.sourceName,
)

// 修改后
const autoScore = calculateAutoScore(
  source.quality,
  extractFileSize(source.sourceName),
  source.sourceName || null,
)
```

---

**错误 2.3**：`ratingPerfTest.ts` - 参数类型错误
```
error TS2345: Argument of type 'Player' is not assignable to parameter of type 'string'.
```

**修复**：
```typescript
// 修改前
calculateAutoScore(player)

// 修改后
calculateAutoScore(
  player.quality,
  extractFileSize(player.sourceName),
  player.sourceName || null,
)
```

同时需要：
1. 导出 `extractFileSize` 函数
2. 在 `ratingPerfTest.ts` 中导入该函数

---

**错误 2.4**：`ratingPerfTest.ts` - 未使用的变量
```
error TS6133: 'scores' is declared but its value is never read.
```

**修复**：
```typescript
// 修改前
const scores = players.map(player => calculateAutoScore(player))

// 修改后
void players.map(player => calculateAutoScore(
  player.quality,
  extractFileSize(player.sourceName),
  player.sourceName || null,
))
```

---

**错误 2.5**：`ratingPerfTest.ts` - Mock 数据类型不完整
```
error TS2322: Type '{ id: string; movieId: string; ... }' is not assignable to type 'Player[]'.
  Type '{ ... }' is missing the following properties from type 'Player': sourceName, sourceUrl
```

**修复**：
```typescript
// 为 mock 数据添加缺失的属性
const mockPlayers: Player[] = Array.from({ length: 100 }, (_, i) => ({
  id: `player-${i}`,
  movieId: `movie-${Math.floor(i / 10)}`,
  // ... 其他属性
  sourceName: `播放源 ${i + 1} ${quality} ${size}GB`,
  sourceUrl: `http://example.com/${i}`,
}))
```

---

**错误 2.6**：`MovieDetail.vue` - 可能为 undefined 的对象访问
```
error TS2532: Object is possibly 'undefined'.
```

**修复**：
```typescript
// 修改前
:class="getPlayerRating(player).warningTag.includes('💀')"
{{ getPlayerRating(player).warningTag.includes('💀') ? '💀 低质' : '⚠️ 注意' }}

// 修改后
:class="getPlayerRating(player).warningTag?.includes('💀')"
{{ getPlayerRating(player).warningTag?.includes('💀') ? '💀 低质' : '⚠️ 注意' }}
```

### 3. 清理未使用的代码

**删除**：`apps/api/src/utils/cache.ts` 中的 `withCache` 函数
- 该函数未被使用
- 实现不完整（ttl 参数未使用）

## 验证结果

### TypeScript 类型检查
```bash
# 后端
cd apps/api && npx tsc --noEmit
✅ 通过

# 前端
cd apps/movie-app && npx vue-tsc --noEmit
✅ 通过
```

### Git 提交
```bash
git add -A
git commit -m "fix: 修复 Cloudflare Workers 部署错误"
✅ 通过 (包括 lint-staged 检查)

git push origin main
✅ 推送成功
```

## 部署状态

- ✅ 代码已推送到 `main` 分支
- 🔄 GitHub Actions 将自动触发：
  - Cloudflare Workers (API) 部署
  - Cloudflare Pages (前端) 部署

## 后续步骤

1. **监控部署流水线**
   - 检查 GitHub Actions 工作流状态
   - 确认 Cloudflare Workers 部署成功
   - 确认 Cloudflare Pages 部署成功

2. **生产环境验证**（任务 31.4-31.6）
   - [ ] 执行生产数据库迁移
   - [ ] 验证生产环境功能正常
   - [ ] 监控首 24 小时错误率和使用率

3. **验收测试**（任务 32.1-32.8）
   - [ ] Aria2 连接成功率 > 95%
   - [ ] 性能指标验证
   - [ ] Bug 统计和分级
   - [ ] 单元测试覆盖率检查
   - [ ] 端到端测试结果
   - [ ] 用户反馈收集

## 技术总结

### Cloudflare Workers 环境差异

1. **不支持 Node.js APIs**
   - `process.env` 不可用
   - 需使用 Hono 的 `c.env` 或 wrangler.toml 配置

2. **环境变量配置方式**
   ```toml
   # wrangler.toml
   [vars]
   FEATURE_FLAG_ARIA2 = "true"
   FEATURE_FLAG_RATING = "true"
   ```

3. **推荐实践**
   - 提供合理的默认值（所有功能启用）
   - 通过配置文件管理功能开关
   - 避免直接访问 Node.js 特定 API

### TypeScript 严格模式

1. **可选链使用**
   - 对可能为 undefined 的属性使用 `?.`
   - Vue 模板中同样需要使用可选链

2. **类型完整性**
   - Mock 数据需包含所有必需属性
   - 注意区分 `undefined` 和 `null` 类型

3. **函数参数使用**
   - 未使用的参数添加 `_` 前缀
   - 或使用 `void` 消费返回值

## 修改文件列表

### 第二轮修复
1. `apps/api/src/utils/cache.ts` - 移除 setInterval，改为惰性清理

### 第一轮修复
1. `apps/api/src/utils/featureFlags.ts` - 修复 process.env 使用
2. `apps/api/src/utils/cache.ts` - 删除未使用函数
3. `apps/movie-app/src/utils/aria2PerfTest.ts` - 参数命名修复
4. `apps/movie-app/src/utils/playbackSources.ts` - 类型修复、导出函数
5. `apps/movie-app/src/utils/ratingPerfTest.ts` - 类型修复、Mock 数据完善
6. `apps/movie-app/src/views/MovieDetail.vue` - 可选链修复

## 提交记录

### 第二轮修复
**Commit**: `5f113fd`
**Message**: fix: 移除 cache.ts 中的 setInterval，改为惰性清理策略

修改统计：
- 2 files changed
- 304 insertions(+)
- 12 deletions(-)

### 第一轮修复
**Commit**: `1eb85ce`
**Message**: fix: 修复 Cloudflare Workers 部署错误

修改统计：
- 7 files changed
- 33 insertions(+)
- 41 deletions(-)
