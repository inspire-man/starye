# Movie MVP：目录体验与媒体完整性

## 目标

让 Movie 影库具备接近 javdb 的高密度目录体验：快速搜索、番号和标签筛选、竖版海报网格、详情预览、继续观看与推荐；同时让封面缺失从一次性脚本问题变成可观察、可回填、可验证的数据流程。

## 已落地

- 影库首页支持 `/` 快捷聚焦搜索框。
- MovieCard 使用 `3:4` 海报比例，网格和列表布局保持一致。
- JavBus crawler、JavBus strategy、JavDB strategy 读取 `data-src`、`data-original`、`currentSrc`、`src`。
- JavBus/JavDB 预览图沿用同一懒加载解析顺序。
- 现有 `missing-images`、`needsImageRefresh`、`crawler-backfill-covers` 和 R2 图片探测链路可继续执行回填。

## 数据完整性流程

1. 抓取器解析源站详情页，先读取懒加载属性，再进行 URL 规范化。
2. 图片探测确认响应为图片后，交给 OptimizedCrawler 下载并写入 R2。
3. 同步服务只接受托管媒体 URL；已有托管封面在异常增量同步时保留。
4. 管理端通过 `/admin/movies/missing-images` 获取缺失媒体的番号和回填来源。
5. 回填完成后通过 Gateway 读取管理接口，并通过 D1 读回确认封面已落库。

## 回归矩阵

| 层级 | 验证 |
| --- | --- |
| 解析 | Crawler 懒加载封面/预览图测试 |
| 任务 | OptimizedCrawler 与 `backfill-covers` 测试 |
| UI | Movie 应用完整 Vitest、MovieDetail、Player 测试 |
| 运行态 | `http://localhost:8080/api/health` |
| 生产数据 | 管理会话下缺失列表、回填任务状态、D1 封面读回 |

## 下一阶段

- 在管理端展示缺封面数量、最近创建批次、失败原因和可重试动作。
- 为回填任务增加批次摘要和成功/失败/跳过计数。
- 对封面空值、非托管 URL、图片探测失败分别统计，避免把不同问题合并成一个“缺封面”状态。
- 通过 Gateway 和已登录管理会话完成一次真实生产回填验收。
