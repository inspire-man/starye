## 1. TorrServer HTTP 客户端

- [x] 1.1 创建 `apps/movie-app/src/utils/torrServerClient.ts`，实现 `TorrServerClient` class，包含：`getVersion()`（GET /echo）、`addTorrent(magnet)`（POST /torrents action:add）、`getTorrentInfo(hash)`（POST /torrents action:get）、`listTorrents()`（POST /torrents action:list）、`removeTorrent(hash)`（POST /torrents action:rem）、`getStreamUrl(magnet, fileIndex)` URL 构建方法、`getTorrentStat(link)`（GET /stream?stat）。复用 Aria2Client 的请求超时和错误处理模式。验证：TypeScript 编译通过，导出类型正确
- [x] 1.2 在 `TorrServerClient` 中实现视频文件识别辅助方法 `filterVideoFiles(files)`，按扩展名（.mp4/.mkv/.avi/.ts/.wmv/.flv）过滤，返回文件列表按大小降序排列。验证：对 mock 文件列表能正确过滤和排序

## 2. Vue Composable 层

- [x] 2.1 创建 `apps/movie-app/src/composables/useTorrServer.ts`，实现全局单例 composable，包含：`config` ref（serverUrl）、`isConnected` ref、`serverVersion` ref、`isLoading` ref。初始化时从 localStorage key `torrserver-config` 读取配置。验证：多个组件调用 `useTorrServer()` 共享同一状态
- [x] 2.2 实现 `saveConfig()`、`loadConfig()`、`testConnection()` 方法，testConnection 调用 `client.getVersion()` 更新连接状态。验证：保存配置后刷新页面能恢复，测试连接成功/失败有正确 toast 提示
- [x] 2.3 实现核心方法 `streamMagnet(magnetUrl)`：提交磁链 → 获取文件列表 → 调用文件选择逻辑 → 返回 `{ streamUrl, fileName }`。文件选择逻辑：单视频文件自动选择；多视频文件大小差 > 10% 时选最大；否则返回 `needsSelection: true` + 文件列表。验证：对单文件种子返回正确的流 URL

## 3. 个人中心设置 UI

- [x] 3.1 创建 `apps/movie-app/src/components/TorrServerSettings.vue` 组件，包含：服务地址输入框（默认 `http://localhost:8090`）、测试连接按钮（loading 状态）、连接状态指示器（绿色/灰色圆点 + 文字）、版本号显示。UI 风格与 `Aria2Settings.vue` 保持一致。验证：组件渲染正确，输入地址后点测试连接能正确反馈
- [x] 3.2 修改 `apps/movie-app/src/views/Profile.vue`：在 `TabType` 联合类型中新增 `'torrserver-settings'`；在 `tabOptions` 数组中新增 `{ label: '🎬 TorrServer', value: 'torrserver-settings' }`；在 template 中新增对应的 `v-show` 区块渲染 `TorrServerSettings` 组件。验证：个人中心 tab 可切换到 TorrServer 设置页，移动端下拉也可见

## 4. MovieDetail.vue 集成在线播放按钮

- [x] 4.1 在 `apps/movie-app/src/views/MovieDetail.vue` 中导入 `useTorrServer`，在磁力链接播放源操作按钮区新增「▶ 在线播放」按钮：`v-if="isMagnetLink(player.sourceUrl) && torrServerConnected"`，样式 `bg-teal-600 hover:bg-teal-700`。验证：TorrServer 连接时按钮可见，未连接时不渲染
- [x] 4.2 实现 `playViaTorrServer(player)` 方法：调用 `useTorrServer().streamMagnet(player.sourceUrl)`，成功后 `router.push({ name: 'player', params: { code: movie.code }, query: { streamUrl } })`。如果返回 `needsSelection`，打开文件选择 Modal。验证：点击按钮后能正确跳转到播放页
- [x] 4.3 新增文件选择 Modal（在 MovieDetail.vue template 底部），列出视频文件名和大小，点击文件项触发播放跳转。复用现有 Modal 动画样式（`.modal-enter-active` 等）。验证：多文件种子时 Modal 弹出，选择文件后跳转播放

## 5. Player.vue 支持 TorrServer 流

- [x] 5.1 修改 `apps/movie-app/src/views/Player.vue` 的 `fetchMovieAndPlay()` 方法：检查 `route.query.streamUrl`，如果存在则直接使用该 URL 调用 `initPlayer(streamUrl, 0)`（TorrServer 流不支持续播），跳过 API 获取 player 的逻辑。验证：带 `?streamUrl=xxx` 访问播放页能正确初始化播放器
- [x] 5.2 新增 TorrServer 缓冲 overlay：当 `route.query.streamUrl` 存在时，显示一个半透明 loading 层（"正在缓冲..."），监听 xgplayer 的 `canplay` 事件后隐藏。验证：打开 TorrServer 流时能看到缓冲提示，开始播放后自动消失
- [x] 5.3 新增播放错误降级处理：监听 xgplayer `error` 事件，在 TorrServer 模式下显示格式不支持提示 + 「添加到 Aria2」按钮 + 「返回详情页」按钮。验证：当流 URL 返回不支持的格式时，用户能看到降级选项

## 6. 验收测试

- [x] 6.1 端到端验证完整链路：在本地启动 TorrServer → 配置连接 → 进入影片详情页 → 点击磁力链接的「在线播放」→ 确认跳转到 Player.vue 并开始播放。验证：MP4 格式种子全链路可播
- [x] 6.2 验证未连接 TorrServer 时的 UI 状态：不配置 TorrServer → 进入影片详情页 → 确认「在线播放」按钮不存在 → 其他按钮功能正常。验证：不影响现有功能
