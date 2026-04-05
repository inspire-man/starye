## ADDED Requirements

### Requirement: 磁力链接提交到 TorrServer
系统 MUST 能将磁力链接提交到 TorrServer 的 `POST /torrents` 端点（action: add），并获取种子的 hash 和文件列表。

#### Scenario: 成功提交磁力链接
- **WHEN** 用户点击磁力链接播放源的「在线播放」按钮
- **THEN** 系统调用 `POST /torrents` 提交 `{action: "add", link: "<magnet_url>"}` ，TorrServer 返回种子信息（hash、文件列表）

#### Scenario: 提交失败 — 无效磁力链接
- **WHEN** 磁力链接格式无效或 hash 不存在
- **THEN** 系统捕获 TorrServer 返回的错误，显示 "磁力链接无效或无法解析" 提示，不跳转到播放页面

#### Scenario: 提交失败 — TorrServer 未连接
- **WHEN** 用户点击「在线播放」但 TorrServer 未连接
- **THEN** 系统显示 "请先在个人中心配置 TorrServer 连接" 错误提示

### Requirement: HTTP 流 URL 构建
系统 MUST 根据 TorrServer 的磁力链接和文件索引构建可播放的 HTTP 流 URL，格式为 `{serverUrl}/stream/video?link={magnet}&index={fileIndex}&play`。

#### Scenario: 构建单文件种子的流 URL
- **WHEN** 种子仅包含一个视频文件（index=0）
- **THEN** 生成 URL: `http://localhost:8090/stream/video?link=magnet:...&index=0&play`

#### Scenario: 构建多文件种子的流 URL
- **WHEN** 种子包含多个文件，用户选择了 index=2 的文件
- **THEN** 生成 URL: `http://localhost:8090/stream/video?link=magnet:...&index=2&play`

### Requirement: xgplayer 播放 TorrServer 流
系统 MUST 将 TorrServer 输出的 HTTP 流 URL 传递给 Player.vue 中的 xgplayer 进行播放。

#### Scenario: 成功播放 MP4/H.264 流
- **WHEN** TorrServer 输出的视频流为 MP4(H.264) 格式
- **THEN** xgplayer 正常初始化并开始播放，用户可以拖动进度条

#### Scenario: 播放失败 — 不支持的视频格式
- **WHEN** 视频流格式为 MKV/AVI/HEVC 等浏览器不原生支持的格式
- **THEN** xgplayer 触发错误事件，系统显示 "当前视频格式浏览器不支持，建议使用 Aria2 下载后本地播放" 提示，并提供「添加到 Aria2」快捷按钮

#### Scenario: 播放超时 — 种子冷启动
- **WHEN** 提交磁链后 30 秒内 TorrServer 未开始输出视频数据
- **THEN** 系统显示 "种子做种者较少，等待时间较长。建议使用 Aria2 下载" 提示，用户可选择继续等待或降级到 Aria2 下载
