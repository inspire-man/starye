# 爬虫反检测与错误恢复设计

## Context

当前项目有两个爬虫：
1. **漫画爬虫** (`site-92hm.ts`) - 爬取 92hm.life，当前在 GitHub Actions 中失败率高
2. **影片爬虫** (`javbus.ts`) - 爬取 JavBus/镜像站，运行稳定

**问题现状**：
- 漫画爬虫出现 `net::ERR_ABORTED` 错误（连接被服务器主动中止）
- 现有的 `retryPageGoto` 无法处理此类错误
- Movie 爬虫虽稳定，但速度可优化（当前 16.23 部/分钟）

**技术约束**：
- 运行在 GitHub Actions (ubuntu-latest) 环境
- 使用 Puppeteer + Chrome for Testing
- 需要遵守目标网站的服务条款（合理延迟、避免过载）
- 预算有限（Actions 免费时长）

**关键决策点**：
- 如何伪装请求以绕过反爬虫检测
- 如何平衡速度和稳定性
- 如何统一两个爬虫的反检测策略

## Goals / Non-Goals

**Goals:**
1. 修复漫画爬虫的 `ERR_ABORTED` 错误，成功率 > 95%
2. 建立统一的反爬虫检测对抗机制
3. 在保持稳定性前提下优化 Movie 爬虫速度
4. 提供可配置的反检测策略，便于针对不同网站调整
5. 改进错误监控和诊断能力

**Non-Goals:**
1. 不使用付费代理服务（成本考虑）
2. 不进行激进的高速爬取（避免被封 IP）
3. 不添加 CAPTCHA 识别（目前未遇到）
4. 不重写整个爬虫架构（保持现有结构）

## Decisions

### Decision 1: 请求头伪装策略

**选择**: 使用 `puppeteer-extra-plugin-stealth` + 自定义请求头

**理由**:
- `puppeteer-extra-plugin-stealth` 已在项目中使用，成熟可靠
- 可自动处理大部分浏览器指纹特征
- 允许自定义额外的请求头（Referer、Accept-Language 等）

**替代方案**:
- ❌ 手动管理所有请求头：维护成本高，容易遗漏
- ❌ 使用真实浏览器（非 headless）：资源消耗大，不适合 CI 环境
- ❌ 使用代理池：成本高，配置复杂

**实现细节**:
```typescript
// 增强的 Page 配置
await page.setExtraHTTPHeaders({
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Referer': baseUrl, // 模拟从首页点击进入
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'same-origin',
  'Upgrade-Insecure-Requests': '1',
})

// 设置真实的 User-Agent（从浏览器列表随机选择）
await page.setUserAgent(getRealUserAgent())
```

### Decision 2: 智能延迟策略

**选择**: 三层延迟机制 - 基础延迟 + 随机化 + 自适应调整

**理由**:
- 基础延迟保证最低间隔（避免过快）
- 随机化使请求更像人类行为
- 自适应调整根据成功率动态调整延迟

**实现方案**:
```typescript
interface DelayConfig {
  base: number      // 基础延迟（ms）
  random: number    // 随机范围（ms）
  errorBackoff: number  // 错误时的退避倍数
  maxDelay: number  // 最大延迟限制
}

// 漫画爬虫配置（GitHub Actions）
const mangaDelay: DelayConfig = {
  base: 8000,        // 基础 8 秒
  random: 4000,      // 随机 0-4 秒
  errorBackoff: 1.5, // 错误时延迟增加 50%
  maxDelay: 30000,   // 最大 30 秒
}

// Movie 爬虫配置（当前稳定）
const movieDelay: DelayConfig = {
  base: 6000,        // 保持当前策略
  random: 4000,
  errorBackoff: 1.3,
  maxDelay: 20000,
}
```

**替代方案**:
- ❌ 固定延迟：容易被识别为机器人
- ❌ 完全随机：可能过快或过慢，不可控
- ❌ 基于响应时间自适应：实现复杂，收益不明显

### Decision 3: 错误分类与处理

**选择**: 建立错误分类系统，针对性处理不同类型错误

**错误分类**:

| 错误类型 | 描述 | 处理策略 |
|---------|------|---------|
| `ERR_ABORTED` | 连接被主动中止 | 增加延迟 + 更换请求头 + 重试 |
| `TimeoutError` | 导航超时 | 增加超时时间 + 重试 |
| `ERR_CONNECTION_REFUSED` | 连接被拒绝 | 长时间退避（可能被临时封禁）|
| `404/500` | HTTP 错误 | 跳过不重试（资源问题）|
| 其他 | 未知错误 | 标准重试策略 |

**实现方案**:
```typescript
async function handleCrawlError(error: Error, context: CrawlContext) {
  const errorType = classifyError(error)
  
  switch (errorType) {
    case 'ERR_ABORTED':
      // 最严重：可能被反爬虫检测
      await sleep(context.config.base * 2) // 双倍延迟
      context.retries++
      if (context.retries < 3) {
        context.headers = rotateHeaders() // 更换请求头
        return 'RETRY'
      }
      return 'SKIP'
    
    case 'TIMEOUT':
      context.timeout *= 1.5 // 增加超时时间
      return context.retries < 2 ? 'RETRY' : 'SKIP'
    
    case 'CONNECTION_REFUSED':
      // 可能 IP 被封，长时间退避
      await sleep(60000) // 等待 1 分钟
      return context.retries < 1 ? 'RETRY' : 'ABORT_ALL'
    
    default:
      return context.retries < 2 ? 'RETRY' : 'SKIP'
  }
}
```

### Decision 4: Cookie 和 Session 管理

**选择**: 为每个爬虫会话维护 Cookie 上下文

**理由**:
- 模拟真实用户浏览行为
- 避免频繁的"首次访问"检测
- 保持会话连续性

**实现方案**:
```typescript
class CrawlerSession {
  private cookies: Protocol.Network.Cookie[] = []
  
  async initialize(page: Page) {
    // 首先访问首页，建立会话
    await page.goto(this.baseUrl, { waitUntil: 'domcontentloaded' })
    await sleep(2000) // 停留一会儿，模拟浏览
    
    // 保存 Cookies
    this.cookies = await page.cookies()
  }
  
  async applyCookies(page: Page) {
    if (this.cookies.length > 0) {
      await page.setCookie(...this.cookies)
    }
  }
}
```

**替代方案**:
- ❌ 不管理 Cookie：每次都是"新用户"，容易触发检测
- ❌ 持久化 Cookie 到文件：GitHub Actions 环境无文件系统持久化
- ✅ 会话级 Cookie（选中）：平衡性能和真实性

### Decision 5: 成功率监控与自动降速

**选择**: 实时监控爬取成功率，自动调整延迟

**理由**:
- 当成功率下降时，可能正在被监控，需要主动降速
- 避免完全失败（被封 IP）
- 自动化调整，无需人工干预

**实现方案**:
```typescript
class SuccessRateMonitor {
  private window: boolean[] = [] // 滑动窗口
  private windowSize = 20
  
  record(success: boolean) {
    this.window.push(success)
    if (this.window.length > this.windowSize) {
      this.window.shift()
    }
  }
  
  getSuccessRate(): number {
    if (this.window.length === 0) return 1.0
    const successes = this.window.filter(x => x).length
    return successes / this.window.length
  }
  
  shouldSlowDown(): boolean {
    const rate = this.getSuccessRate()
    return rate < 0.7 // 成功率低于 70% 时降速
  }
}

// 在爬虫主循环中
if (monitor.shouldSlowDown()) {
  currentDelay *= 1.5 // 延迟增加 50%
  console.warn('⚠️  成功率下降，自动降速')
}
```

### Decision 6: Movie 爬虫优化策略

**选择**: 保守优化，优先保证稳定性

**当前状态**:
- 速度: 16.23 部/分钟
- 成功率: 100%
- 配置: 详情页并发=2，延迟=6-10秒

**优化方案**:
```typescript
// 可选优化（需要充分测试）
const optimizedMovieConfig = {
  detailConcurrency: 3,     // 2 -> 3（提升 50%）
  detailDelay: { base: 5000, random: 3000 }, // 略微减少延迟
  imageConcurrency: 3,      // 2 -> 3
}
```

**预期收益**:
- 速度提升约 20-30%（达到 20+ 部/分钟）
- 成功率保持 > 95%

**风险缓解**:
- 先在小批量测试（MAX_MOVIES=20）
- 监控成功率，如下降立即回滚
- 保留原配置作为 fallback

## Risks / Trade-offs

### Risk 1: 过度伪装导致性能下降

**风险**: 添加大量请求头和 Cookie 管理逻辑可能增加延迟

**Mitigation**:
- 只在必要时应用伪装策略
- 缓存 Cookie 和请求头模板
- 性能测试验证影响 < 10%

### Risk 2: 反爬虫机制升级

**风险**: 目标网站可能升级反爬虫策略（CAPTCHA、WAF 等）

**Mitigation**:
- 设计可扩展的架构，便于添加新策略
- 监控错误日志，及时发现新的反爬虫手段
- 保持合理的爬取频率，避免触发升级

### Risk 3: GitHub Actions IP 被封禁

**风险**: 如果多个用户使用相同 Actions IP 爬取，可能被封禁

**Mitigation**:
- 实现 IP 被封检测（连续 ERR_CONNECTION_REFUSED）
- 自动暂停任务，等待 IP 轮换
- 降低每日爬取量（当前 500 部/天已相对保守）
- 未来考虑：使用 workflow_dispatch 手动触发，避免定时任务冲突

### Risk 4: 配置过于复杂

**风险**: 引入过多配置项，维护困难

**Mitigation**:
- 提供合理的默认值
- 按环境分层配置（本地/CI）
- 文档化每个配置项的作用和推荐值

### Trade-off 1: 速度 vs 稳定性

**Trade-off**: 提升速度会增加被检测风险

**选择**: 优先稳定性
- 漫画爬虫：先修复再优化
- Movie 爬虫：小幅优化（20% 以内）
- 保留降速机制作为安全网

### Trade-off 2: 通用性 vs 针对性

**Trade-off**: 通用策略 vs 针对每个网站定制

**选择**: 混合模式
- 提供通用的反检测基础设施（请求头、延迟、错误处理）
- 允许每个策略覆盖特定配置
- 漫画和 Movie 爬虫可使用不同参数

## Migration Plan

### Phase 1: 漫画爬虫修复（Priority）

1. **实现反检测基础设施**
   - 创建 `CrawlerSession` 类
   - 实现智能延迟逻辑
   - 添加错误分类处理

2. **集成到 site-92hm.ts**
   - 应用增强的请求头
   - 使用新的延迟策略
   - 启用 Cookie 管理

3. **本地测试**
   ```bash
   # 小批量测试
   MAX_MANGAS=5 pnpm --filter @starye/crawler test:comic
   ```

4. **GitHub Actions 测试**
   - 修改 workflow 参数（max_mangas=10）
   - 验证成功率 > 90%
   - 逐步放开到正常量（15-20）

### Phase 2: Movie 爬虫优化（Optional）

1. **实施保守优化**
   - 并发: 2 -> 3
   - 延迟略微减少

2. **A/B 测试**
   - 分两次运行：原配置 vs 新配置
   - 对比速度和成功率

3. **监控和调整**
   - 观察 7 天数据
   - 如成功率 < 95%，回滚

### Rollback Strategy

如果出现问题：

1. **快速回滚**:
   ```bash
   git revert <commit-hash>
   git push
   ```

2. **配置回滚**:
   - GitHub Actions 中添加 `USE_LEGACY_MODE` 环境变量
   - 当设置为 `true` 时使用原有逻辑

3. **监控指标**:
   - 成功率 < 80% → 立即回滚
   - 错误日志出现新类型错误 → 暂停调查

## Open Questions

1. **Q: 是否需要实现 User-Agent 轮换池？**
   - A: 第一版使用固定的真实 User-Agent，观察效果
   - 如仍有问题，考虑添加轮换逻辑

2. **Q: Movie 爬虫的优化是否必要？**
   - A: 用户反馈当前速度可接受
   - 优化为可选项，优先级低于漫画修复

3. **Q: 是否需要添加更多监控指标？**
   - A: 当前日志已较详细
   - 可考虑未来添加 Grafana/Prometheus 监控

4. **Q: 如何处理 CAPTCHA（如果出现）？**
   - A: 当前未遇到
   - 如遇到，考虑：
     - 降低爬取频率
     - 添加 CAPTCHA 识别（如 2captcha）
     - 使用代理服务
