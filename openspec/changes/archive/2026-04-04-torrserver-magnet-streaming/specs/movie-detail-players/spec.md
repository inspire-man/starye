## MODIFIED Requirements

### Requirement: 播放源操作按钮区
影片详情页的磁力链接播放源卡片 MUST 新增「在线播放」操作按钮，仅在 TorrServer 已连接时可见。该按钮与现有的复制、Aria2、打开、二维码、评分、上报按钮并列。

#### Scenario: TorrServer 已连接时显示在线播放按钮
- **WHEN** 用户查看影片详情页某个磁力链接播放源，且 `useTorrServer().isConnected` 为 `true`
- **THEN** 该播放源操作区域 MUST 显示「▶ 在线播放」按钮，样式使用 `bg-teal-600 hover:bg-teal-700`

#### Scenario: TorrServer 未连接时隐藏在线播放按钮
- **WHEN** 用户查看影片详情页，但 TorrServer 未配置或未连接
- **THEN** 「在线播放」按钮不渲染，其他按钮布局不受影响

#### Scenario: 点击在线播放触发流播放流程
- **WHEN** 用户点击某个磁力链接的「在线播放」按钮
- **THEN** 系统依次执行：提交磁链到 TorrServer → 获取文件列表 → 选择视频文件 → 构建流 URL → 路由跳转到 `/movie/:code/play?streamUrl=<url>`

#### Scenario: 非磁力链接播放源不显示在线播放按钮
- **WHEN** 播放源的 `sourceUrl` 不是 `magnet:` 协议
- **THEN** 该播放源 MUST 不显示「在线播放」按钮（保留现有的外链播放按钮）
