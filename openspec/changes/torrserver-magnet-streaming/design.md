## Context

当前影片播放链路为：`MovieDetail.vue → router /movie/:code/play → Player.vue`，Player.vue 从 API 获取 player 的 `sourceUrl` 后直接喂给 xgplayer。对于磁力链接，这条路径走不通——xgplayer 无法直接播放 `magnet:` 协议。

用户已有 Aria2 自部署基础设施，现需引入 TorrServer 作为「磁力链接 → HTTP 视频流」的中间层。TorrServer 是单二进制 Go 程序，暴露 HTTP API，部署模型与 Aria2 完全一致。

核心约束：
- **纯前端直连**：TorrServer 运行在用户本地/内网，前端直接 fetch，不经过 Cloudflare Workers（与 Aria2 直连模式一致）
- **零后端改动**：不新增 API 路由、不修改数据库 schema
- **复用现有模式**：配置持久化用 localStorage、composable 用单例全局状态、Client 用 class + 请求队列

## Goals / Non-Goals

**Goals:**
- 磁力链接一键在线播放，复用已有 xgplayer 播放器 MUST
- TorrServer 连接配置管理，集成到个人中心已有设置区域 MUST
- 种子多文件时智能选择视频文件 MUST
- 播放缓冲状态反馈 SHALL

**Non-Goals:**
- 不做视频转码（依赖 TorrServer + 浏览器原生能力）
- 不做后端代理（TorrServer 已自带 CORS 支持）
- 不做 TorrServer 安装引导
- 不修改现有 player 表或 movie 表 schema

## Decisions

### D1: TorrServer 客户端架构 — 独立 class + composable 双层

**选择**：`TorrServerClient`（底层 HTTP 客户端）+ `useTorrServer`（Vue 响应式 composable），与 `Aria2Client` + `useAria2` 模式完全对齐。

**理由**：
- 已有成熟模式，团队（虽然是个人）维护心智负担为零
- Client 层可独立测试，不依赖 Vue 响应式系统
- Composable 层提供全局单例状态，多个组件共享连接状态

**替代方案**：合并为一个 composable 内联 fetch。放弃原因：与 Aria2 不一致，且 Client 不可独立复用。

### D2: 流播放入口 — 在 MovieDetail.vue 磁力链接操作区新增按钮

**选择**：在现有磁力链接操作按钮区（复制/Aria2/打开/二维码）旁新增「▶ 在线播放」按钮，仅当 `useTorrServer().isConnected` 为 true 时显示。

**理由**：
- 最小改动，与现有 UI 布局自然融合
- 条件渲染保证未配置 TorrServer 的用户不受影响
- 按钮位置紧挨 Aria2 按钮，形成「下载 / 在线播」操作对

### D3: 播放路由策略 — 复用现有 `/movie/:code/play` + query 参数传递流 URL

**选择**：点击在线播放时，先通过 TorrServerClient 提交磁链获取流 URL，然后 `router.push({ name: 'player', params: { code }, query: { streamUrl } })`。Player.vue 检测 `route.query.streamUrl` 存在时直接使用该 URL，否则走原有逻辑。

**理由**：
- 复用现有路由和组件，不需要新建页面
- query 参数方式简单直接，无需全局状态传递
- Player.vue 保持向后兼容，无 streamUrl 时行为不变

**替代方案**：新建 `/movie/:code/stream` 路由 + 独立 StreamPlayer.vue。放弃原因：Player.vue 已有完善的播放器初始化和进度保存逻辑，重复代码太多。

### D4: 文件选择策略 — 自动选最大视频文件，异常时弹窗手选

**选择**：
1. 提交磁链到 TorrServer 后获取文件列表
2. 按文件大小降序排列，选择第一个视频扩展名（.mp4/.mkv/.avi/.ts/.wmv）文件
3. 如果没有视频文件或有多个大小接近的视频文件（差异 < 10%），弹出文件选择对话框

**理由**：BT 资源通常有一个主视频文件 + 若干字幕/封面/样本文件。按大小排序在 > 95% 场景下能正确选中主文件。

### D5: 缓冲反馈 — Player.vue 新增 overlay 层

**选择**：在 TorrServer 模式下，Player.vue 显示一个半透明 overlay 展示：
- 缓冲状态文案（"正在加载种子信息..."/"正在缓冲..."/"播放中"）
- 如果 TorrServer 提供 stat 信息，展示下载速度和做种者数量

**理由**：种子流播放有明显的冷启动延迟（5-30 秒），不做反馈用户会以为挂了。

### D6: 个人中心设置 — 与 Aria2 并列的独立 Tab

**选择**：在 Profile.vue 的 tab 列表中新增「🎬 TorrServer」tab，内容为 `TorrServerSettings.vue` 组件（与 `Aria2Settings.vue` 对称）。

**理由**：
- 已有 tab 模式，扩展自然
- 设置项简单（仅一个 URL 输入 + 测试按钮），独立组件保持 Profile.vue 不膨胀

## Risks / Trade-offs

**[视频格式兼容性]** → HTML5 `<video>` 原生不支持 MKV/HEVC。TorrServer MatriX 版本有内置转码能力，但依赖服务端 FFmpeg。当检测到 xgplayer 播放错误时，显示 "当前视频格式浏览器不支持，建议使用 Aria2 下载后本地播放" 提示，并提供一键添加到 Aria2 的快捷操作。

**[CORS 限制]** → TorrServer 默认启用 CORS，但某些环境可能需要 `--cors` 启动参数。设置页面中增加 CORS 说明文案。如果后续用户反馈 CORS 问题普遍，可考虑增加 Cloudflare Workers 代理模式（参考 Aria2 的 `useProxy` 模式）。

**[冷启动延迟]** → 做种者少的种子可能需要很长时间才能开始播放。设置 30 秒超时，超时后提示用户 "种子做种者较少，建议使用 Aria2 下载" 并降级。

**[安全性]** → TorrServer URL 存储在 localStorage，无敏感凭证（TorrServer 默认无认证）。如果未来 TorrServer 增加认证，需要扩展配置项。
