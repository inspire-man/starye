### Requirement: 播放缓冲状态反馈
系统 SHALL 在 TorrServer 流播放模式下显示缓冲状态 overlay，帮助用户理解加载进度。

#### Scenario: 种子信息加载中
- **WHEN** 磁力链接已提交但种子元数据尚未解析完成
- **THEN** Player.vue 显示 overlay 文案 "正在加载种子信息..."

#### Scenario: 视频缓冲中
- **WHEN** 种子元数据已解析，视频流正在缓冲
- **THEN** Player.vue 显示 overlay 文案 "正在缓冲..."，如果有速度信息则同时显示下载速度

#### Scenario: 播放正常进行
- **WHEN** 视频已开始播放且缓冲充足
- **THEN** overlay 自动隐藏

### Requirement: 播放错误降级处理
系统 MUST 在 TorrServer 流播放失败时提供降级操作入口。

#### Scenario: 格式不支持时的降级选项
- **WHEN** xgplayer 因格式不支持触发播放错误
- **THEN** 在错误提示区域显示两个操作按钮：「添加到 Aria2」和「返回详情页」

#### Scenario: 连接中断的错误处理
- **WHEN** 播放过程中 TorrServer 连接中断
- **THEN** 显示 "TorrServer 连接中断" 错误提示，并提供「重试」和「返回详情页」按钮
