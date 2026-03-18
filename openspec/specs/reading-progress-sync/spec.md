# reading-progress-sync Specification

## Purpose
TBD - created by archiving change build-user-apps. Update Purpose after archive.
## Requirements
### Requirement: 系统记录用户的漫画阅读进度

系统 SHALL 自动保存已登录用户的漫画阅读进度。

#### Scenario: 首次阅读保存进度
- **WHEN** 已登录用户首次阅读某章节并停留超过3秒
- **THEN** 系统创建该章节的阅读进度记录（userId + chapterId + page）

#### Scenario: 更新阅读进度
- **WHEN** 用户继续阅读同一章节（滚动到新页码）
- **THEN** 系统在3秒防抖后更新该章节的进度记录

#### Scenario: 防抖策略避免频繁请求
- **WHEN** 用户在3秒内快速滚动
- **THEN** 系统不发送 API 请求，仅在3秒后发送最后一次进度

#### Scenario: 页面卸载前强制保存
- **WHEN** 用户关闭阅读器页面或切换到其他章节
- **THEN** 系统立即保存当前进度（绕过防抖）

### Requirement: 系统恢复用户的漫画阅读进度

系统 SHALL 在用户重新打开章节时，自动恢复上次的阅读位置。

#### Scenario: 打开有进度的章节
- **WHEN** 已登录用户打开之前阅读过的章节
- **THEN** 系统自动滚动到上次保存的页码位置

#### Scenario: 打开无进度的章节
- **WHEN** 已登录用户打开从未阅读过的章节
- **THEN** 系统默认显示第一页

#### Scenario: 跨设备同步
- **WHEN** 用户在设备A阅读到第X页，然后在设备B打开同一章节
- **THEN** 设备B自动恢复到第X页

### Requirement: 系统记录用户的影片观看进度

系统 SHALL 自动保存已登录用户的影片观看进度。

#### Scenario: 首次观看保存进度
- **WHEN** 已登录用户播放某影片超过10秒
- **THEN** 系统创建该影片的观看进度记录（userId + movieCode + progress + duration）

#### Scenario: 定期更新观看进度
- **WHEN** 用户持续观看影片
- **THEN** 系统每隔10秒更新观看进度（当前播放时间点）

#### Scenario: 播放器暂停/关闭时保存
- **WHEN** 用户暂停播放或关闭播放页面
- **THEN** 系统立即保存当前播放进度

### Requirement: 系统恢复用户的影片观看进度

系统 SHALL 在用户重新打开影片时，提示继续播放。

#### Scenario: 打开有进度的影片
- **WHEN** 已登录用户打开之前观看过的影片
- **THEN** 系统显示"继续播放"提示（显示上次播放的时间点）

#### Scenario: 点击继续播放
- **WHEN** 用户点击"继续播放"按钮
- **THEN** 系统跳转到上次保存的播放时间点

#### Scenario: 点击从头播放
- **WHEN** 用户点击"从头播放"按钮
- **THEN** 系统从0秒开始播放

#### Scenario: 已观看完毕的影片
- **WHEN** 用户打开已观看到95%以上的影片
- **THEN** 系统默认从头播放（不显示继续播放提示）

### Requirement: 未登录用户使用本地存储

系统 SHALL 为未登录用户提供本地进度存储（localStorage）。

#### Scenario: 未登录用户保存进度到本地
- **WHEN** 未登录用户阅读漫画或观看影片
- **THEN** 系统将进度保存到浏览器 localStorage

#### Scenario: 未登录用户恢复本地进度
- **WHEN** 未登录用户重新打开之前访问的内容
- **THEN** 系统从 localStorage 读取进度并恢复

#### Scenario: 登录后同步本地进度到云端
- **WHEN** 用户在有本地进度的情况下登录
- **THEN** 系统将 localStorage 中的进度同步到服务端，并清除本地存储

### Requirement: 数据库支持进度查询

系统 SHALL 提供高效的进度查询接口。

#### Scenario: 批量查询阅读进度
- **WHEN** 用户访问书架页面（显示多个漫画）
- **THEN** 系统一次性查询该用户所有漫画的阅读进度（单次 SQL 查询）

#### Scenario: 单个进度查询
- **WHEN** 用户打开特定章节
- **THEN** 系统查询该章节的进度记录（通过 userId + chapterId 索引）

#### Scenario: 观看历史排序
- **WHEN** 用户访问观看历史页面
- **THEN** 系统按 `updatedAt` 字段倒序查询最近的观看记录

### Requirement: 进度数据保留策略

系统 SHALL 定期清理过期的进度数据。

#### Scenario: 保留近期进度
- **WHEN** 用户的进度记录超过6个月未更新
- **THEN** 系统在定期清理任务中删除该进度记录

#### Scenario: 活跃用户进度永久保留
- **WHEN** 用户的进度记录在最近6个月内有更新
- **THEN** 系统保留该进度记录

