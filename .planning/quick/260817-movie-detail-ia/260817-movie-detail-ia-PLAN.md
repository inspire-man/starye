---
quick_id: 260817-movie-detail-ia
title: 影片详情页信息架构与首次使用引导
status: complete
branch: main
---

# 目标

让用户进入影片详情后能快速判断“现在应该点什么”，同时把来源健康、revision、receipt 等工程诊断信息收纳到技术详情中，保持现有播放、TorrServer、Aria2、收藏、评分、上报业务流程不变。

## 必须满足

- 首屏突出影片身份、来源状态和一个明确的主操作。
- 为直链、磁力在线播放、磁力下载提供简短的“怎么用”说明。
- 播放源卡片保留现有可用操作，但默认只突出播放/下载主动作，次要操作收纳。
- 技术状态仍可展开查看，现有 `data-*` DOM 契约与 readiness 业务状态保持兼容。
- 桌面端与 390px 移动端均保持可读、可点击和不横向溢出。

## 任务

### 1. 详情页首屏和操作层级

- 状态：完成

- 文件：`apps/movie-app/src/views/MovieDetail.vue`
- 增加状态摘要、主 CTA、收藏/下载入口和锚点导航。
- 增加“怎么使用”引导，按 direct/magnet/未连接服务解释下一步。

### 2. 播放源与技术详情重排

- 状态：完成

- 文件：`apps/movie-app/src/views/MovieDetail.vue`
- 让播放源卡片默认展示质量、健康状态和主动作；复制、二维码、评分、上报进入次级操作区。
- 将 readiness 的工程字段放入可展开技术详情，保留失败、修复和刷新入口。
- 使用共享主题 token 与现有页面响应式边界，不引入 API/数据库改动。

### 3. 回归与记录

- 状态：完成

- 更新 `MovieDetail` DOM 契约测试，覆盖主 CTA、使用引导、技术详情折叠和次级操作。
- 完成 Movie App type-check、lint、定向测试、build、`git diff --check`、Gateway/浏览器边界检查。
- 提交前执行 GitNexus `detect_changes(scope="all", repo="starye")`，确认只影响详情页展示和测试。
