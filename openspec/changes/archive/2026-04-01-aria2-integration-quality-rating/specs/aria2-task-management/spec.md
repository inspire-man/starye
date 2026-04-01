# Spec: Aria2 下载任务管理

## ADDED Requirements

### Requirement: 用户可以添加磁链到 Aria2

系统 SHALL 允许用户直接从播放源添加磁力链接到 Aria2 下载任务 MUST。

#### Scenario: 单个磁链添加
- **WHEN** 用户在影片详情页点击磁力链接的"添加到 Aria2"按钮
- **THEN** 系统调用 Aria2 RPC `aria2.addUri` 方法，创建下载任务，并显示"已添加到 Aria2"提示

#### Scenario: 批量磁链添加
- **WHEN** 用户在下载列表选中多个影片并点击"批量添加到 Aria2"
- **THEN** 系统批量调用 Aria2 RPC，创建多个下载任务，并显示"已添加 N 个任务"

#### Scenario: Aria2 未连接时添加
- **WHEN** Aria2 未连接且用户尝试添加任务
- **THEN** 系统显示错误提示"请先配置 Aria2 连接"，并引导用户到设置页面

#### Scenario: 磁链格式错误
- **WHEN** 播放源 URL 不是有效的 magnet:// 链接
- **THEN** 系统拒绝添加并提示"无效的磁力链接"

### Requirement: 用户可以查询 Aria2 下载任务

系统 MUST 允许用户查询和查看 Aria2 中的下载任务列表及详情。

#### Scenario: 查询所有任务
- **WHEN** 用户访问下载任务管理页面
- **THEN** 系统调用 `aria2.tellActive`, `aria2.tellWaiting`, `aria2.tellStopped` 获取所有任务并展示

#### Scenario: 查询单个任务详情
- **WHEN** 用户点击某个任务查看详情
- **THEN** 系统调用 `aria2.tellStatus` 获取任务完整信息，包括文件列表、速度、进度等

#### Scenario: 任务列表为空
- **WHEN** Aria2 中没有任务
- **THEN** 系统显示空状态提示"暂无下载任务"

### Requirement: 用户可以控制下载任务

系统 SHALL 提供下载任务的暂停、恢复、删除、优先级调整功能 MUST。

#### Scenario: 暂停下载任务
- **WHEN** 用户点击正在下载任务的"暂停"按钮
- **THEN** 系统调用 `aria2.pause` 暂停任务，更新状态为"已暂停"

#### Scenario: 恢复下载任务
- **WHEN** 用户点击已暂停任务的"恢复"按钮
- **THEN** 系统调用 `aria2.unpause` 恢复任务，更新状态为"下载中"

#### Scenario: 删除下载任务
- **WHEN** 用户点击任务的"删除"按钮并确认
- **THEN** 系统调用 `aria2.remove` 或 `aria2.forceRemove` 删除任务，并从列表中移除

#### Scenario: 调整任务优先级
- **WHEN** 用户拖拽任务或使用"置顶"按钮
- **THEN** 系统调用 `aria2.changePosition` 调整任务在队列中的位置

### Requirement: 任务与下载列表同步

系统 MUST 保持 Aria2 任务与本地下载列表的数据同步。

#### Scenario: 添加到 Aria2 时同步到下载列表
- **WHEN** 用户通过播放源添加磁链到 Aria2
- **THEN** 系统同时添加影片到下载列表，记录 Aria2 任务 GID

#### Scenario: Aria2 任务完成时更新下载列表
- **WHEN** Aria2 任务状态变为"完成"
- **THEN** 系统自动更新下载列表中对应影片的状态为"已完成"

#### Scenario: 从 Aria2 删除任务时同步
- **WHEN** 用户在 Aria2 管理界面删除任务
- **THEN** 系统可选同步删除下载列表中的对应项（由用户设置决定）

### Requirement: 错误处理和重试

系统 SHALL 妥善处理 Aria2 RPC 调用失败场景 MUST。

#### Scenario: RPC 调用超时
- **WHEN** Aria2 RPC 调用超过 10 秒未响应
- **THEN** 系统显示"操作超时"错误，并提供重试选项

#### Scenario: Aria2 服务繁忙
- **WHEN** Aria2 返回资源不足错误
- **THEN** 系统自动重试最多 3 次，间隔递增（1s, 2s, 4s）

#### Scenario: 未知错误
- **WHEN** RPC 调用返回未知错误码
- **THEN** 系统记录错误日志，向用户显示友好错误消息和错误码
