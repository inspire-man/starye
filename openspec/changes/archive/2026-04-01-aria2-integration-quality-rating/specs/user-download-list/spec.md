# Spec: 用户下载列表（扩展）

## MODIFIED Requirements

### Requirement: 下载列表支持 Aria2 任务关联

系统 MUST 扩展下载列表功能，支持与 Aria2 任务的双向关联和同步。

#### Scenario: 记录 Aria2 任务 GID
- **WHEN** 影片通过 Aria2 添加到下载列表
- **THEN** 系统在下载列表项中记录 Aria2 任务的 GID（Global ID）

#### Scenario: 显示 Aria2 任务状态
- **WHEN** 下载列表项关联了 Aria2 任务
- **THEN** 系统从 Aria2 查询实时状态并显示（下载中/已暂停/已完成/错误）

#### Scenario: 无 Aria2 关联的项
- **WHEN** 下载列表项未通过 Aria2 添加
- **THEN** 系统显示状态为"计划下载"，不显示 Aria2 相关信息

### Requirement: 实时下载进度同步

系统 MUST 将 Aria2 任务的实时进度同步到下载列表。

#### Scenario: 显示下载进度条
- **WHEN** 下载列表项关联的 Aria2 任务正在下载
- **THEN** 系统显示进度条、已下载/总大小、下载速度

#### Scenario: 显示预计完成时间
- **WHEN** Aria2 任务下载速度稳定
- **THEN** 系统计算并显示 ETA（预计剩余时间）

#### Scenario: 任务完成自动更新
- **WHEN** Aria2 任务完成下载
- **THEN** 系统自动将下载列表项状态更新为"已完成"

### Requirement: 快捷任务操作

系统 SHALL 在下载列表中提供 Aria2 任务的快捷操作 MUST。

#### Scenario: 从列表暂停任务
- **WHEN** 用户在下载列表中点击"暂停"按钮
- **THEN** 系统调用 Aria2 RPC 暂停对应任务

#### Scenario: 从列表恢复任务
- **WHEN** 用户在下载列表中点击"恢复"按钮
- **THEN** 系统调用 Aria2 RPC 恢复对应任务

#### Scenario: 删除任务和列表项
- **WHEN** 用户从下载列表删除项目
- **THEN** 系统询问是否同时删除 Aria2 任务，根据用户选择执行

### Requirement: Aria2 任务导入

系统 SHALL 支持从 Aria2 导入现有任务到下载列表 MUST。

#### Scenario: 检测未关联任务
- **WHEN** 用户打开下载列表页面
- **THEN** 系统查询 Aria2 中的所有任务，检测是否有未关联到下载列表的磁力任务

#### Scenario: 批量导入任务
- **WHEN** 检测到未关联的磁力任务
- **THEN** 系统显示提示"发现 N 个未关联任务"，提供一键导入功能

#### Scenario: 智能匹配影片
- **WHEN** 导入 Aria2 任务
- **THEN** 系统尝试从磁链的 dn 参数或文件名中提取番号，自动匹配影片信息

## ADDED Requirements

### Requirement: 下载列表数据扩展

系统 MUST 扩展下载列表项的数据结构，支持 Aria2 集成。

#### Scenario: 存储 Aria2 关联信息
- **WHEN** 创建或更新下载列表项
- **THEN** 系统存储 `aria2Gid`（任务ID）、`aria2Status`（任务状态）、`downloadProgress`（进度百分比）

#### Scenario: 存储下载统计
- **WHEN** Aria2 任务进行中
- **THEN** 系统记录 `downloadSpeed`（下载速度）、`completedLength`（已下载大小）、`totalLength`（总大小）

#### Scenario: 向后兼容
- **WHEN** 读取旧版下载列表数据
- **THEN** 系统正确处理不包含 Aria2 字段的数据，不报错
