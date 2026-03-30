# Proposal: Aria2 集成与播放源质量评分

## Why

当前播放源管理系统仅提供磁力链接的复制和协议调用，用户仍需手动在 BT 客户端管理下载任务，体验割裂且效率低下。同时，面对多个播放源时，用户缺乏有效的质量判断依据，无法快速选择最佳资源。本变更旨在通过集成 Aria2 RPC 和构建质量评分系统，提供从资源发现到下载管理的一站式解决方案，显著提升用户体验和资源利用效率。

## 背景

基于 Phase 1 播放源管理系统的成功实现，我们已经具备：
- 完整的播放源展示和磁力链接管理
- 下载列表管理（状态、筛选、导出）
- 二维码生成等移动端友好功能
- 94.69% 测试覆盖率的稳定代码基础

然而用户反馈和使用数据显示：
1. **下载体验断层**：用户需要在浏览器和 BT 客户端之间频繁切换
2. **资源选择困难**：面对多个播放源时难以判断质量优劣
3. **管理效率低下**：无法批量管理下载任务，状态更新依赖手动操作

## 目标

### 主要目标
1. **打通下载全流程**：集成 Aria2 RPC，实现从浏览器直接管理下载任务 MUST
2. **智能资源推荐**：构建播放源质量评分系统，帮助用户快速选择最佳资源 MUST
3. **实时状态同步**：通过 WebSocket 实现下载进度实时更新 MUST
4. **提升用户体验**：减少操作步骤，提高下载管理效率 SHALL

### 非目标
- ❌ 不实现完整的 BT 客户端功能（仅作为 Aria2 的管理界面）
- ❌ 不涉及种子文件的上传和托管
- ❌ 不实现 P2P 网络的底层协议
- ❌ 暂不支持其他下载工具（qBittorrent、Transmission 等）

## What Changes

### 1. Aria2 RPC 集成

**前端新增功能**：
- Aria2 连接配置管理（RPC 地址、密钥、连接状态）
- 一键添加磁链到 Aria2（单个/批量）
- 实时下载进度显示（速度、完成度、ETA）
- 下载任务管理（暂停/恢复/删除/优先级调整）
- WebSocket 连接管理和自动重连
- 下载完成通知和状态自动同步

**后端新增功能**：
- Aria2 RPC 代理服务（可选，解决跨域问题）
- 下载任务状态缓存和同步
- 用户 Aria2 配置存储（D1 数据库）

### 2. 播放源质量评分系统

**前端新增功能**：
- 播放源自动评分算法（基于画质、文件大小、来源可信度）
- 用户评分功能（1-5 星）
- 评分统计展示（平均分、评分人数）
- 智能推荐标签（高质量源高亮显示）
- 评分趋势分析图表

**后端新增功能**：
- 播放源评分数据模型（ratings 表）
- 评分聚合 API（计算平均分、统计）
- 自动评分算法服务
- 评分缓存和更新策略

### 3. UI/UX 改进

- 播放源卡片新增评分显示区域
- Aria2 设置页面（个人中心）
- 下载任务面板（实时进度条、状态图标）
- 下载列表与 Aria2 任务双向同步
- 移动端优化的 Aria2 控制界面

## Capabilities

### New Capabilities
- `aria2-rpc-connection`: Aria2 RPC 连接管理，包括配置、认证、状态检测 MUST
- `aria2-task-management`: 下载任务的创建、查询、控制（暂停/恢复/删除）MUST
- `aria2-realtime-progress`: WebSocket 实时下载进度推送和状态同步 MUST
- `playback-source-rating`: 播放源质量评分系统，包含自动评分和用户评分 MUST
- `rating-aggregation`: 评分数据聚合和统计分析 MUST
- `smart-source-recommendation`: 基于评分的智能播放源推荐 SHALL

### Modified Capabilities
- `user-download-list`: 扩展下载列表功能，支持与 Aria2 任务同步，新增 `aria2Gid`、`downloadProgress` 等字段 MUST

## Impact

### 前端影响
- **新增文件**：
  - `apps/movie-app/src/composables/useAria2.ts` - Aria2 连接和任务管理
  - `apps/movie-app/src/composables/useAria2WebSocket.ts` - WebSocket 实时通信
  - `apps/movie-app/src/composables/useRating.ts` - 评分管理
  - `apps/movie-app/src/components/Aria2Settings.vue` - 设置页面
  - `apps/movie-app/src/components/DownloadTaskPanel.vue` - 任务面板
  - `apps/movie-app/src/components/RatingStars.vue` - 评分组件
  - `apps/movie-app/src/utils/aria2Client.ts` - Aria2 JSON-RPC 客户端
  - `apps/movie-app/src/utils/ratingAlgorithm.ts` - 自动评分算法

- **修改文件**：
  - `apps/movie-app/src/views/MovieDetail.vue` - 集成评分展示和 Aria2 快捷操作
  - `apps/movie-app/src/views/Profile.vue` - 添加 Aria2 设置和任务管理 tab
  - `apps/movie-app/src/types.ts` - 新增 Aria2 和评分相关类型
  - `apps/movie-app/src/composables/useDownloadList.ts` - 扩展支持 Aria2 同步

### 后端影响
- **新增文件**：
  - `apps/api/src/routes/aria2/index.ts` - Aria2 代理路由（可选）
  - `apps/api/src/routes/ratings/index.ts` - 评分 API
  - `apps/api/src/services/rating.service.ts` - 评分业务逻辑
  - `apps/api/src/services/aria2-proxy.service.ts` - Aria2 代理服务（可选）

- **数据库变更**：
  - 新增 `ratings` 表（id、playerId、userId、score、createdAt）
  - 新增 `aria2_configs` 表（userId、rpcUrl、secret、createdAt）
  - 扩展 `player` 表，添加 `averageRating`、`ratingCount` 字段
  - 迁移文件：`packages/db/drizzle/0020_*.sql`

### 依赖变化
- **新增前端依赖**：
  - 无需新增（使用原生 WebSocket 和 fetch）
  
- **新增后端依赖**：
  - 无需新增（使用 Hono 内置功能）

### API 影响
- **新增 API**：
  - `POST /api/ratings` - 提交评分
  - `GET /api/ratings/player/:playerId` - 获取播放源评分
  - `GET /api/ratings/stats` - 获取评分统计
  - `POST /api/aria2/proxy` - Aria2 RPC 代理（可选）
  - `GET /api/aria2/config` - 获取用户 Aria2 配置
  - `PUT /api/aria2/config` - 更新 Aria2 配置

- **修改 API**：
  - `GET /api/movies/:code` - 响应中 players 包含评分信息（`averageRating`、`ratingCount`）

## 风险

### 技术风险
1. **Aria2 兼容性**：不同版本的 Aria2 RPC 接口可能存在差异
   - 缓解：支持主流版本（1.34.0+），提供版本检测
   
2. **WebSocket 稳定性**：长连接可能因网络波动断开
   - 缓解：自动重连机制、心跳检测、降级到轮询

3. **跨域问题**：Aria2 RPC 可能需要代理
   - 缓解：提供后端代理服务（可选）

4. **性能问题**：大量评分数据可能影响查询性能
   - 缓解：评分数据缓存、索引优化、分页加载

### 产品风险
1. **用户学习成本**：Aria2 配置对新手可能复杂
   - 缓解：提供详细的配置向导、默认配置模板
   
2. **评分质量**：初期评分数据不足，推荐准确度低
   - 缓解：自动评分算法打底、引导用户评分

3. **隐私问题**：评分数据和 Aria2 配置涉及用户隐私
   - 缓解：Aria2 密钥加密存储、评分匿名化

### 安全风险
1. **RPC 密钥泄露**：Aria2 密钥存储不当可能泄露
   - 缓解：服务端加密存储、HTTPS 传输
   
2. **恶意评分**：刷评分、恶意低分攻击
   - 缓解：评分频率限制、异常检测、用户信誉系统

## 里程碑

### M1: Aria2 基础集成（第 1-2 周）
- ✅ Aria2 连接配置管理
- ✅ 基础 JSON-RPC 客户端实现
- ✅ 添加磁链到 Aria2（单个）
- ✅ 查询任务状态（轮询）

### M2: 实时进度和任务管理（第 2-3 周）
- ✅ WebSocket 连接和自动重连
- ✅ 实时下载进度推送
- ✅ 任务控制（暂停/恢复/删除）
- ✅ 批量添加任务

### M3: 播放源评分系统（第 3-4 周）
- ✅ 数据库 schema 设计和迁移
- ✅ 评分 API 实现
- ✅ 自动评分算法
- ✅ 用户评分 UI

### M4: 智能推荐和优化（第 4-5 周）
- ✅ 评分聚合和统计
- ✅ 智能推荐算法
- ✅ 性能优化和缓存
- ✅ 完整测试覆盖

### M5: 测试和部署（第 5-6 周）
- ✅ 端到端测试
- ✅ 生产环境部署
- ✅ 用户验收测试
- ✅ 文档和培训材料

## 成功标准

### 功能标准
- Aria2 连接成功率 > 95% MUST
- 下载任务添加成功率 > 98% MUST
- 评分提交成功率 > 99% MUST
- WebSocket 断线重连时间 < 3 秒 SHALL

### 性能标准
- Aria2 RPC 调用响应时间 < 500ms MUST
- 评分查询响应时间 < 200ms MUST
- 实时进度更新延迟 < 1 秒 SHALL
- 前端页面无明显卡顿 MUST

### 质量标准
- 单元测试覆盖率 > 90% MUST
- E2E 测试通过率 100% MUST
- 无严重 Bug (P0/P1) MUST
- 用户满意度 ≥ 4.0/5.0 SHALL

### 使用指标
- Aria2 功能使用率 > 30% SHALL
- 评分参与率 > 20% SHALL
- 下载任务平均管理时间减少 50% MUST
- 用户留存率提升 15% SHALL
