# Spec: Aria2 实时下载进度

## ADDED Requirements

### Requirement: 实时下载进度展示

系统 MUST 通过 WebSocket 实时显示 Aria2 下载任务的进度信息。

#### Scenario: 显示下载速度
- **WHEN** 任务正在下载
- **THEN** 系统实时显示当前下载速度（KB/s, MB/s），每秒更新

#### Scenario: 显示完成进度
- **WHEN** 任务正在下载
- **THEN** 系统显示进度条和百分比（0%-100%），实时更新

#### Scenario: 显示预计剩余时间
- **WHEN** 任务正在下载且速度稳定
- **THEN** 系统计算并显示预计剩余时间（ETA）

#### Scenario: 显示已下载/总大小
- **WHEN** 任务信息可用
- **THEN** 系统显示"已下载/总大小"（如 2.5GB / 8.5GB）

### Requirement: WebSocket 连接管理

系统 SHALL 维护稳定的 WebSocket 连接用于实时数据推送 MUST。

#### Scenario: 建立 WebSocket 连接
- **WHEN** 用户访问包含实时进度的页面且 Aria2 已配置
- **THEN** 系统建立 WebSocket 连接到 Aria2 或后端代理

#### Scenario: 连接断开自动重连
- **WHEN** WebSocket 连接因网络问题断开
- **THEN** 系统在 3 秒后自动尝试重连，最多重试 5 次

#### Scenario: 重连失败降级
- **WHEN** WebSocket 重连多次失败
- **THEN** 系统降级到 HTTP 轮询模式（每 2 秒查询一次），并提示用户"实时更新已禁用"

### Requirement: 心跳检测

系统 MUST 通过心跳机制保持 WebSocket 连接活跃。

#### Scenario: 发送心跳包
- **WHEN** WebSocket 连接建立后
- **THEN** 系统每 30 秒发送一次 ping 消息

#### Scenario: 心跳超时
- **WHEN** 连续 3 次心跳无响应
- **THEN** 系统判定连接失效，关闭连接并尝试重连

### Requirement: 进度通知

系统 SHALL 在下载任务状态变化时发送通知 MUST。

#### Scenario: 任务开始下载通知
- **WHEN** 任务从"等待"变为"下载中"
- **THEN** 系统显示通知"《影片标题》开始下载"

#### Scenario: 任务完成通知
- **WHEN** 任务下载完成
- **THEN** 系统显示通知"《影片标题》下载完成"，并播放提示音（可选）

#### Scenario: 任务失败通知
- **WHEN** 任务因错误停止
- **THEN** 系统显示通知"《影片标题》下载失败：<错误原因>"

### Requirement: 多任务进度聚合

系统 SHALL 提供多个任务的聚合进度信息 MUST。

#### Scenario: 显示总下载速度
- **WHEN** 有多个任务同时下载
- **THEN** 系统显示所有任务的总下载速度

#### Scenario: 显示队列统计
- **WHEN** 用户查看任务列表
- **THEN** 系统显示"活跃/等待/已完成"任务数量统计

#### Scenario: 显示总进度
- **WHEN** 有多个任务
- **THEN** 系统计算并显示所有任务的整体完成百分比
