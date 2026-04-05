# Proposal: TorrServer 集成 — 磁力链接在线播放

## Why

当前影片详情页对磁力链接只提供复制、二维码、Aria2 下载等「离线」操作。用户必须先下载完整文件再本地播放，整个流程割裂且耗时长。TorrServer 是一个成熟的开源种子流媒体引擎（Go 语言，单二进制文件），可以将磁力链接实时转为 HTTP 视频流，使 xgplayer 直接播放。它的部署模型与用户已有的 Aria2 完全一致 —— 自托管、免费、通过 HTTP API 交互，学习成本极低。

## 背景

已有基础设施：
- **Aria2 集成**：`aria2Client.ts` 已实现完整的 JSON-RPC 客户端模式（连接管理、请求队列、超时处理），可直接复用架构
- **xgplayer 播放器**：`Player.vue` 已支持 HTTP URL 播放和观看进度保存
- **播放源管理**：`MovieDetail.vue` 已具备磁力链接识别、Aria2 按钮等模式，新增 TorrServer 按钮是自然延伸

TorrServer（YouROK/TorrServer）核心 API：
- `GET /echo` — 返回版本号，用于连接检测
- `POST /torrents` — 种子管理（`add`/`get`/`set`/`rem`/`list`/`drop`）
- `GET /stream/fname?link=<magnet>&index=<n>&play` — 核心流媒体端点，返回 HTTP 视频流
- `GET /playlist?link=<magnet>` — 返回 M3U 播放列表

## 目标

### 主要目标
1. **磁链一键播放**：用户在影片详情页点击「在线播放」，系统将磁力链接提交至 TorrServer，获取 HTTP 流并在 xgplayer 中播放 MUST
2. **TorrServer 连接管理**：在个人中心提供 TorrServer 配置（地址），支持连接状态检测 MUST
3. **文件选择**：种子包含多个文件时，自动选择最大的视频文件，或允许用户手动选择 MUST
4. **缓冲状态反馈**：播放时展示缓冲进度和下载速度，避免用户在等待时迷惑 SHALL

### 非目标
- ❌ 不实现视频转码（依赖 TorrServer 自身能力或浏览器原生支持）
- ❌ 不做 TorrServer 的安装/部署引导（用户是技术型，自行部署）
- ❌ 不集成 Debrid 等付费云服务（后续可扩展）
- ❌ 不涉及后端 API 变更（TorrServer 由前端直连，与 Aria2 模式一致）

## What Changes

### 1. TorrServer HTTP 客户端

新增 `apps/movie-app/src/utils/torrServerClient.ts`，复用 Aria2Client 的架构模式：

```
┌──────────────────────────────────────────────────────┐
│  TorrServerClient                                    │
├──────────────────────────────────────────────────────┤
│  getVersion()          GET /echo                     │
│  addTorrent(magnet)    POST /torrents {action:"add"} │
│  getTorrent(hash)      POST /torrents {action:"get"} │
│  listTorrents()        POST /torrents {action:"list"} │
│  removeTorrent(hash)   POST /torrents {action:"rem"} │
│  getStreamUrl(magnet, fileIndex) → URL 拼接           │
│  getPlaylist(magnet)   GET /playlist?link=...         │
│  getTorrentStat(link)  GET /stream?link=...&stat      │
└──────────────────────────────────────────────────────┘
```

### 2. Composable：`useTorrServer`

新增 `apps/movie-app/src/composables/useTorrServer.ts`：
- 连接配置持久化（localStorage，与 Aria2 模式一致）
- 连接状态响应式管理（`isConnected`、`serverVersion`）
- `streamMagnet(magnetUrl)` — 核心方法：添加种子 → 获取文件列表 → 选择视频文件 → 返回 HTTP 流 URL

### 3. 前端 UI 集成

**MovieDetail.vue 变更**：
- 磁力链接播放源卡片新增「▶ 在线播放」按钮（仅当 TorrServer 已连接时显示）
- 点击后路由至 Player.vue，传递 TorrServer 流 URL

**Player.vue 变更**：
- 支持接收 TorrServer 流 URL 播放
- 新增缓冲进度 overlay（TorrServer 模式下显示）

**个人中心变更**：
- 在已有的 Aria2 设置旁新增 TorrServer 设置 tab
- 配置项：TorrServer 地址（默认 `http://localhost:8090`）
- 连接测试按钮

### 4. 数据流架构

```
用户点击「在线播放」
        │
        ▼
┌─────────────────┐    POST /torrents     ┌──────────────┐
│  MovieDetail.vue │ ──────────────────▶  │  TorrServer   │
│  (前端)          │    {action:"add",     │  (自部署)      │
│                  │     link: magnet}     │               │
│                  │ ◀────────────────── │  返回 hash +   │
│                  │    torrent info       │  文件列表      │
└────────┬────────┘                       └───────┬───────┘
         │                                         │
         │  router.push('/player/:code?            │
         │    torrserver=<stream_url>')             │
         ▼                                         │
┌─────────────────┐    GET /stream?        ┌──────┴───────┐
│   Player.vue     │    link=...&index=n   │  TorrServer   │
│   (xgplayer)     │ ──────────────────▶  │  HTTP Stream   │
│                  │ ◀ ─ ─ video/mp4 ─ ─  │               │
└─────────────────┘                       └──────────────┘
```

## Capabilities

### New Capabilities
- `torrserver-connection`: TorrServer 连接管理，包括配置持久化和状态检测 MUST
- `torrserver-magnet-stream`: 磁力链接在线播放，从提交磁链到获取 HTTP 流的完整链路 MUST
- `torrserver-file-selection`: 种子多文件时的视频文件自动/手动选择 MUST
- `torrserver-buffer-feedback`: 播放时的缓冲状态和下载速度反馈 SHALL

### Modified Capabilities
- `movie-detail-players`: 扩展播放源操作按钮，新增 TorrServer 在线播放入口 MUST

## Impact

### 新增文件
- `apps/movie-app/src/utils/torrServerClient.ts` — TorrServer HTTP 客户端
- `apps/movie-app/src/composables/useTorrServer.ts` — 连接管理和流媒体 composable

### 修改文件
- `apps/movie-app/src/views/MovieDetail.vue` — 新增「在线播放」按钮
- `apps/movie-app/src/views/Player.vue` — 支持 TorrServer 流 URL + 缓冲反馈
- `apps/movie-app/src/views/Profile.vue` — 新增 TorrServer 设置 tab

### 依赖变化
- 无新增依赖（纯 HTTP fetch 交互，与 Aria2 模式一致）

### 后端影响
- 无（TorrServer 由前端直连，不经过 Cloudflare Workers API）

## 风险

### 技术风险
1. **视频格式兼容性**：BT 资源可能包含 MKV/AVI/HEVC 格式，xgplayer 基于 HTML5 `<video>` 仅原生支持 MP4(H.264) + WebM
   - 缓解：TorrServer MatriX 版本内置 FFmpeg 转码能力；对于不支持的格式显示明确提示并降级到下载模式
2. **跨域问题**：前端直连本地 TorrServer 可能遇到 CORS 限制
   - 缓解：TorrServer 默认允许跨域；如有问题，用户可通过 `--cors` 参数启动或配置反向代理
3. **缓冲延迟**：冷启动（无缓存种子）时首次播放可能需要较长缓冲时间
   - 缓解：显示缓冲进度条和预估时间；对于热门种子（做种者多），延迟通常 < 10 秒
4. **TorrServer 版本差异**：不同版本 API 可能有细微差别
   - 缓解：通过 `/echo` 检测版本号，仅支持 MatriX 系列（当前主流）

### 产品风险
1. **目标用户窄**：需要自部署 TorrServer 的前提条件限制了使用人群
   - 接受：用户已表明偏好技术型、免费方案
2. **播放质量不稳定**：取决于种子做种数量和网络状况
   - 缓解：显示做种数信息帮助用户判断；支持手动切换其他播放源

## 里程碑

### M1: TorrServer 客户端 + 连接管理（~2h）
- TorrServerClient 实现（版本检测、种子管理、流 URL 构建）
- useTorrServer composable（配置持久化、连接状态）
- 个人中心 TorrServer 设置 tab

### M2: 播放链路打通（~2h）
- MovieDetail.vue 新增「在线播放」按钮
- 文件选择逻辑（自动选最大视频文件）
- Player.vue 接入 TorrServer 流 URL

### M3: 体验打磨（~1h）
- 缓冲进度反馈 UI
- 格式不支持提示 + 降级处理
- 连接断开/超时的错误处理

## 成功标准

- TorrServer 连接检测成功率 > 95%（本地网络环境下）MUST
- 磁链提交到开始播放时间 < 30 秒（热门种子）SHALL
- xgplayer 可播放 TorrServer 输出的 MP4/H.264 流 MUST
- 格式不支持时有明确错误提示而非白屏 MUST
- 操作路径：详情页 → 点击播放 → 开始观看，不超过 2 次点击 SHALL
