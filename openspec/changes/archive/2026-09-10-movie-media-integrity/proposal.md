## Why
Movie 目录、爬虫和 R2 已能写入媒体 URL，但管理端无法区分空值、外部 URL、探测失败、非图片和来源暂不可用，回填批次也缺少统一摘要与权威读回。

## What Changes
- 增加影片封面、预览图和演员头像的完整性分类与管理端摘要。
- 增加回填批次成功、失败、跳过、重试及原因的 D1 readback。
- 统一 MovieCard、MovieDetail、ActorDetail 使用媒体状态。
- 保留已有托管媒体，避免空结果覆盖已知可用数据。

## Non-goals
不新增媒体代理，不改变 R2 存储策略，不重写现有 crawler 图片下载器。

## Impact
涉及 API、Dashboard、crawler 任务回执和媒体状态展示。必须保留已有电影同步及播放器行为。
