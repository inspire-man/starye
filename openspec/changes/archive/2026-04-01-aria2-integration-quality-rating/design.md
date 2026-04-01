# Design: Aria2 集成与播放源质量评分系统

## Context

### 当前状态

基于 Phase 1 的成功实现，我们已具备完整的播放源管理基础：
- ✅ 播放源数据模型（`player` 表）
- ✅ 磁力链接工具函数（验证、格式化、InfoHash 提取）
- ✅ 下载列表管理（localStorage 持久化，94.69% 测试覆盖）
- ✅ 二维码生成、批量复制、导出等辅助功能
- ✅ 完善的 UI 组件和响应式设计

### 技术约束

1. **Cloudflare 环境限制**
   - Workers 无 Node.js 内置模块，须使用 Web 标准 API
   - CPU 时间限制（10ms 免费，50ms 付费）
   - 无状态执行，需依赖 D1、R2、Durable Objects 等持久化方案

2. **前端技术栈**
   - Vue 3 + Composition API + `<script setup>`
   - Vite + TypeScript
   - Tailwind CSS v4 + Shadcn Vue
   - 无重框架依赖（如 Pinia），优先使用 Composable 模式

3. **后端技术栈**
   - Hono + Drizzle ORM
   - D1 SQLite（关系型数据）
   - Better Auth（会话管理）

4. **现有 API 结构**
   - RESTful 风格，返回格式：`{ code: number, message: string, data: T }`
   - 通过 `apps/gateway` 统一路由分发

### 业务需求

1. **Aria2 集成核心诉求**
   - 打通浏览器到 BT 客户端的断层，实现一站式管理
   - 支持本地 Aria2（localhost）和远程 Aria2（NAS、VPS）
   - 实时进度展示，减少用户手动检查的频率

2. **评分系统核心诉求**
   - 解决"多播放源选择困难"问题
   - 建立社区驱动的质量反馈机制
   - 为未来的推荐算法奠定数据基础

## Goals / Non-Goals

### Goals

1. **Aria2 无缝集成**：提供从配置到任务管理的完整体验 MUST
2. **实时状态同步**：WebSocket 实现秒级进度更新 MUST
3. **智能评分体系**：自动评分 + 用户评分的混合模型 MUST
4. **性能与稳定性**：查询响应 < 200ms，连接稳定性 > 95% MUST
5. **用户友好**：降低 Aria2 配置门槛，提供直观的评分界面 SHALL

### Non-Goals

- ❌ 不实现完整 BT 客户端（种子解析、DHT 网络等）
- ❌ 不支持其他下载工具（qBittorrent、Transmission）
- ❌ 不做服务端种子托管和 Tracker 服务器
- ❌ 不实现高级 BT 功能（超级种子、端口映射等）
- ❌ 不涉及内容分发网络（CDN）和 P2P 加速

## Decisions

### D1: Aria2 RPC 通信架构

**选择**：前端直连 + 可选后端代理

**理由**：
- ✅ **前端直连**（默认）：
  - 延迟最低（无中间层）
  - 减轻服务端压力
  - 适用于本地 Aria2（localhost:6800）
- ✅ **后端代理**（可选）：
  - 解决跨域问题（HTTPS 页面访问 HTTP Aria2）
  - 支持远程 Aria2（防火墙内网穿透）
  - 统一密钥管理和日志记录

**替代方案（未采纳）**：
- ❌ 仅后端代理：增加延迟，Cloudflare Workers CPU 时间受限
- ❌ 仅前端直连：无法解决跨域，限制使用场景

**实现细节**：
- 前端 Composable `useAria2` 检测配置中的 `useProxy` 字段
- 如 `useProxy: true`，发送请求到 `/api/aria2/proxy`
- 后端验证用户身份后转发请求到真实 Aria2 地址

---

### D2: WebSocket vs HTTP 轮询

**选择**：WebSocket 优先，失败降级到 HTTP 轮询

**理由**：
- ✅ **WebSocket**：
  - 实时性最佳（< 1 秒延迟）
  - 减少 HTTP 请求开销
  - 原生浏览器支持，无需依赖
- ⚠️ **HTTP 轮询**（降级）：
  - 兼容性强（网络环境差时）
  - 简单可靠
  - 2 秒轮询间隔，对服务端压力可控

**替代方案（未采纳）**：
- ❌ 仅 HTTP 轮询：延迟高（2-5 秒），用户体验差
- ❌ Server-Sent Events (SSE)：单向推送，无法发送控制命令

**实现细节**：
- 使用 `useAria2WebSocket` Composable 管理连接
- 连接失败重试 5 次（指数退避：1s, 2s, 4s, 8s, 16s）
- 降级逻辑：`setInterval` 轮询 `aria2.tellStatus`

---

### D3: 评分数据存储策略

**选择**：原始评分 + 聚合缓存的混合模式

**理由**：
- ✅ **原始评分表**（`ratings`）：
  - 保留完整评分历史
  - 支持趋势分析和异常检测
  - 便于后续审计和数据修复
- ✅ **聚合缓存**（`player.averageRating`, `player.ratingCount`）：
  - 查询性能优化（无需实时 JOIN 聚合）
  - 减少 D1 查询次数（Cloudflare 有每日免费额度）

**替代方案（未采纳）**：
- ❌ 仅存储聚合数据：无法追溯历史，无法处理异常评分
- ❌ 仅存储原始评分：每次查询都需聚合，性能差

**实现细节**：
```typescript
// 评分提交时更新
ratings.insert({ playerId, userId, score })
player.update({ 
  averageRating: (sum(scores) / count(scores)),
  ratingCount: count(scores) 
})
```

---

### D4: 自动评分算法

**选择**：基于规则的加权评分模型

**理由**：
- 简单可解释，用户能理解评分逻辑
- 无需训练数据，冷启动友好
- 可根据反馈快速调整权重

**权重分配**：
- 画质（60%）：4K=100, 1080P=85, HD=75, 720P=60, SD=40
- 文件大小合理性（20%）：
  - 4K: 8-25GB (+10), <5GB (-20), >30GB (-10)
  - 1080P: 4-12GB (+10), <2GB (-20), >15GB (-10)
  - 其他：合理范围 ±20%
- 来源可信度（20%）：已知站点 +15, 未知 0, 可疑 -20

**替代方案（未采纳）**：
- ❌ 机器学习模型：数据量不足，训练成本高，难以调试
- ❌ 纯用户评分：冷启动问题严重，恶意评分风险高

---

### D5: 数据库 Schema 设计

**选择**：三表分离 + 冗余聚合

**新增表**：

#### `ratings` 表
```sql
CREATE TABLE ratings (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  score INTEGER NOT NULL CHECK(score >= 1 AND score <= 5),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (player_id) REFERENCES player(id),
  FOREIGN KEY (user_id) REFERENCES user(id),
  UNIQUE(player_id, user_id)  -- 每个用户对每个播放源只能评分一次
);

CREATE INDEX idx_ratings_player ON ratings(player_id);
CREATE INDEX idx_ratings_user ON ratings(user_id);
CREATE INDEX idx_ratings_created_at ON ratings(created_at);
```

#### `aria2_configs` 表
```sql
CREATE TABLE aria2_configs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  rpc_url TEXT NOT NULL,
  secret TEXT,  -- 加密存储
  use_proxy INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES user(id)
);
```

**扩展 `player` 表**：
```sql
ALTER TABLE player ADD COLUMN average_rating REAL;
ALTER TABLE player ADD COLUMN rating_count INTEGER DEFAULT 0;
CREATE INDEX idx_player_rating ON player(average_rating DESC);
```

**理由**：
- `UNIQUE(player_id, user_id)` 防止重复评分
- 索引优化查询性能（按评分排序、按用户查询）
- `average_rating` 冗余存储避免每次 JOIN 聚合

---

### D6: 前端状态管理

**选择**：Composable 模式，无全局状态管理库

**理由**：
- Vue 3 Composition API 原生支持状态共享
- 项目规模小，无需 Pinia/Vuex 的复杂度
- `ref` + `provide/inject` 足够应对跨组件通信

**Composable 设计**：

1. **`useAria2`**
   - 管理连接配置、状态检测、RPC 调用
   - 提供 `connect()`, `addUri()`, `tellStatus()` 等方法
   - 状态：`isConnected`, `config`, `tasks`

2. **`useAria2WebSocket`**
   - WebSocket 连接生命周期管理
   - 心跳检测、自动重连、降级逻辑
   - 事件：`onProgress`, `onComplete`, `onError`

3. **`useRating`**
   - 评分提交、查询、统计
   - 自动评分算法调用
   - 状态：`ratings`, `isLoading`, `error`

4. **扩展 `useDownloadList`**
   - 新增字段：`aria2Gid`, `aria2Status`, `downloadProgress`
   - 新增方法：`addToAria2()`, `syncWithAria2()`

---

### D7: API 设计

**RESTful API 设计**：

#### 评分 API
```typescript
// 提交评分
POST /api/ratings
Body: { playerId: string, score: 1-5 }
Response: { code: 0, data: { id, averageRating, ratingCount } }

// 获取播放源评分
GET /api/ratings/player/:playerId
Response: { code: 0, data: { averageRating, ratingCount, userScore?, distribution } }

// 获取统计
GET /api/ratings/stats?type=top&limit=10
Response: { code: 0, data: [{ playerId, movieCode, averageRating, ratingCount }] }

// 获取用户评分历史
GET /api/ratings/user
Response: { code: 0, data: [{ playerId, movieCode, score, createdAt }] }
```

#### Aria2 配置 API
```typescript
// 获取配置
GET /api/aria2/config
Response: { code: 0, data: { rpcUrl, hasSecret, useProxy } }

// 更新配置
PUT /api/aria2/config
Body: { rpcUrl: string, secret?: string, useProxy?: boolean }
Response: { code: 0, data: { id, rpcUrl, useProxy } }

// RPC 代理（可选）
POST /api/aria2/proxy
Body: { method: string, params: any[] }
Response: { code: 0, data: <aria2 response> }
```

#### 影片 API 扩展
```typescript
// 现有 API 扩展
GET /api/movies/:code
Response: {
  code: 0,
  data: {
    ...movie,
    players: [{
      ...player,
      averageRating: 4.8,      // 新增
      ratingCount: 128,         // 新增
      autoScore: 85,            // 新增：自动评分
      userScore: 5              // 新增：当前用户评分（如已登录）
    }]
  }
}
```

---

### D8: 安全设计

**1. Aria2 密钥保护**

- **前端**：不在 localStorage 明文存储密钥，仅存储是否已配置（`hasSecret: boolean`）
- **后端**：
  - 使用 Cloudflare Workers Secret 加密存储（或简单的对称加密）
  - API 返回时不返回明文密钥
  - RPC 代理模式下，密钥不离开服务端

**2. 评分防刷机制**

- **频率限制**：同一用户每分钟最多 10 次评分操作
- **异常检测**：
  - 新注册用户 24 小时内评分 > 50 个，标记审核
  - 连续 10 个极端评分（全 1 星或全 5 星），标记审核
- **用户信誉**：后续可引入信誉系统，低信誉用户评分权重降低

**3. XSS 防护**

- 评分统计数据无用户输入，无 XSS 风险
- Aria2 配置中的 `rpcUrl` 需验证格式，防止注入

---

### D9: 性能优化策略

**1. 评分查询优化**

- **场景**：影片列表页加载 20 部影片，每部 3-5 个播放源
- **问题**：100+ 个播放源的评分聚合查询会很慢
- **方案**：
  - 冗余存储 `player.averageRating`，直接读取无需聚合
  - 使用 D1 `CASE WHEN` 批量查询优化
  - 前端懒加载评分数据（仅当播放源区块展开时加载）

**2. Aria2 任务查询优化**

- **场景**：用户下载列表有 50 个影片，需查询 50 个 GID
- **问题**：逐个查询 `aria2.tellStatus` 延迟高
- **方案**：
  - 使用 `aria2.tellActive` 批量获取活跃任务
  - 缓存 5 秒内查询结果（仅轮询模式）
  - WebSocket 模式下，仅订阅活跃任务的更新

**3. 前端渲染优化**

- 虚拟滚动（下载列表 > 100 项时）
- 评分组件使用 CSS 渲染星星（避免大量 SVG）
- 进度条使用 CSS transform（硬件加速）

---

### D10: 降级和容错

**1. Aria2 不可用时**

- 隐藏所有 Aria2 相关按钮和功能
- 保留原有的"复制磁链"和"打开客户端"功能
- 显示明显的"未连接"状态提示

**2. WebSocket 不可用时**

- 自动降级到 HTTP 轮询（2 秒间隔）
- 用户界面提示"实时更新已禁用"
- 提供"手动刷新"按钮

**3. 评分服务异常时**

- 评分展示区域显示"--"，不影响播放源使用
- 用户评分提交失败时，本地缓存，后续重试
- 自动评分算法在前端计算，无需后端

## Risks / Trade-offs

### R1: Aria2 版本兼容性

**风险**：Aria2 不同版本的 JSON-RPC 接口可能有差异
- → **缓解**：支持主流版本（1.34.0+），启动时检测版本（`aria2.getVersion`）
- → **降级**：不兼容版本仅支持基础功能（添加任务、查询状态）

### R2: 跨域和安全问题

**风险**：HTTPS 页面无法直接访问 HTTP Aria2（Mixed Content）
- → **缓解**：提供后端代理选项
- → **文档**：引导用户配置 Aria2 使用 HTTPS（自签名证书或 Let's Encrypt）

### R3: WebSocket 长连接稳定性

**风险**：移动端或弱网环境下，WebSocket 频繁断开
- → **缓解**：自动重连 + 心跳检测（30 秒 ping/pong）
- → **降级**：3 次重连失败后切换到 HTTP 轮询

### R4: 评分数据冷启动

**风险**：初期评分数据少，推荐准确度低
- → **缓解**：自动评分算法提供基础分数
- → **引导**：UI 引导用户评分（"帮助改进推荐"提示）

### R5: Cloudflare Workers CPU 限制

**风险**：复杂评分算法或大量 RPC 代理请求可能超时
- → **缓解**：
  - 评分聚合使用数据库触发器（SQLite）或后台任务
  - RPC 代理仅转发，不做复杂计算
  - 设置 10 秒超时，避免长时间占用 CPU

### R6: 数据一致性

**风险**：并发评分可能导致 `ratingCount` 不准确
- → **缓解**：使用数据库事务或 `UPDATE ... SET ratingCount = (SELECT COUNT(*) ...)`

## Migration Plan

### 数据库迁移

**步骤**：
1. 创建迁移文件 `packages/db/drizzle/0020_add_ratings.sql`
2. 执行迁移（本地 + 生产）
   ```bash
   pnpm --filter @starye/db run db:migrate:local
   pnpm --filter @starye/db run db:migrate:prod
   ```
3. 验证表结构：`wrangler d1 execute <db> --command "PRAGMA table_info(ratings)"`

**回滚**：
- 保留迁移的 `down` 脚本，必要时执行 `DROP TABLE ratings`
- `player` 表的新字段可不删除（NULL 值不影响现有功能）

### 前端部署

**步骤**：
1. **本地测试**：`pnpm --filter movie-app run dev`，验证 Aria2 和评分功能
2. **构建**：`pnpm --filter movie-app run build`
3. **部署**：推送到 `main` 分支，GitHub Actions 自动部署到 Cloudflare Pages

**回滚**：
- Cloudflare Pages 支持版本回滚，可在控制台一键切换

### 后端部署

**步骤**：
1. **本地测试**：`pnpm --filter api run dev`，验证评分 API
2. **部署**：`pnpm --filter api run deploy`，部署到 Cloudflare Workers

**回滚**：
- Workers 版本管理，可回滚到前一个版本

### 功能开关（Feature Flag）

**可选实现**：
- 在 D1 或环境变量中添加 `ENABLE_ARIA2` 和 `ENABLE_RATING` 开关
- 生产环境初期关闭，小范围用户测试后再全量开启

## Open Questions

### Q1: Aria2 WebSocket 实现方式

**问题**：Aria2 官方支持 WebSocket 吗？还是需要自建 WebSocket 服务订阅状态变化？

**现状**：
- Aria2 官方支持 WebSocket 协议（`ws://localhost:6800/jsonrpc`）
- 可直接连接，无需额外服务

**决策**：使用 Aria2 官方 WebSocket 支持

---

### Q2: 评分显示的实时性要求

**问题**：用户评分后，其他用户多久能看到更新的平均分？

**选项**：
1. 实时更新（提交即可见） - 复杂度高
2. 延迟更新（5-10 秒） - 减少数据库压力
3. 按需刷新（用户手动刷新或重新加载页面） - 最简单

**初步决策**：延迟更新（5 秒缓存），后续根据用户反馈调整

---

### Q3: Aria2 配置的多设备同步

**问题**：用户在多个设备使用，Aria2 配置如何同步？

**选项**：
1. 仅本地存储（localStorage）- 无需后端，但不同步
2. 云端存储（D1）- 支持同步，需登录
3. 混合模式（localStorage + D1，登录时同步）- 最佳体验

**决策**：混合模式（未登录用户用 localStorage，登录用户同步到 D1）

---

### Q4: 评分权重动态调整

**问题**：自动评分和用户评分的权重是否应该根据数据量动态调整？

**当前方案**：
- 评分人数 < 10：自动评分 40% + 用户评分 60%
- 评分人数 ≥ 10：自动评分 20% + 用户评分 80%

**待验证**：此权重是否合理，需通过 A/B 测试验证

---

### Q5: 下载完成后的自动播放

**问题**：Aria2 任务完成后，是否直接在浏览器内播放（WebTorrent）？

**分析**：
- 需要 WebTorrent 支持（Phase 2 低优先级功能）
- 本变更不实现，留待后续

**决策**：本次仅实现下载管理，不涉及播放

## 实现分阶段

### 第一阶段：Aria2 基础功能（MVP）

- ✅ Aria2 连接配置 UI
- ✅ 添加单个磁链到 Aria2
- ✅ 查询任务状态（HTTP 轮询）
- ✅ 暂停/恢复/删除任务
- ⏸️ 不包含 WebSocket、批量操作

**目标**：验证 Aria2 集成的可行性和用户接受度

### 第二阶段：实时进度和评分

- ✅ WebSocket 连接和实时进度
- ✅ 评分系统（数据库、API、UI）
- ✅ 自动评分算法
- ✅ 基础推荐标签

**目标**：完整的功能体验，满足 proposal 所有 MUST 要求

### 第三阶段：优化和扩展

- ✅ 批量操作（批量添加、批量删除）
- ✅ 评分分布图表
- ✅ 个性化推荐
- ✅ 性能优化（虚拟滚动、缓存）

**目标**：提升用户体验，达到 SHALL 要求

## 技术选型总结

| 决策点 | 选择 | 理由 |
|--------|------|------|
| Aria2 通信 | 前端直连 + 可选代理 | 低延迟，灵活性高 |
| 实时通信 | WebSocket + HTTP 降级 | 平衡性能与兼容性 |
| 评分存储 | 原始评分 + 聚合缓存 | 保留历史，优化查询 |
| 自动评分 | 规则引擎 | 简单可解释，冷启动友好 |
| 状态管理 | Composable 模式 | 轻量，符合 Vue 3 最佳实践 |
| 数据库 | D1 SQLite | 符合现有技术栈 |
| 部署方式 | GitHub Actions | 自动化，与现有流程一致 |

## 参考资料

- [Aria2 JSON-RPC 文档](https://aria2.github.io/manual/en/html/aria2c.html#rpc-interface)
- [WebSocket API MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [Cloudflare D1 文档](https://developers.cloudflare.com/d1/)
- Phase 1 实现：`openspec/changes/movie-playback-sources-enhancement/`
