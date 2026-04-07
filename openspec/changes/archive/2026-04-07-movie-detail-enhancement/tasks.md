## 1. API：相关影片 genre fallback

- [x] 1.1 修改 `apps/api/src/routes/public/movies/index.ts` 中 `GET /:code` 的相关影片查询：在 `merged.length < 4` 时追加 genre fallback 查询（取 genres 数组第一个非空值，按 viewCount DESC，排除已有 id，LIMIT `6 - merged.length`）
- [x] 1.2 处理 genres 为空或 fallback 查询失败时的静默兜底（不报错，返回现有结果）
- [x] 1.3 验证 R18 过滤规则在 fallback 查询中与演员/系列查询保持一致

## 2. API：系列影片 limit 提升

- [x] 2.1 将同系列影片查询的 LIMIT 从 6 提升至 8，确保系列导航有足够数据推导位置

## 3. 前端：系列导航组件

- [x] 3.1 在 `apps/movie-app/src/views/MovieDetail.vue` 中新增系列导航区块：从 `relatedMovies` 提取同系列影片，按 releaseDate ASC 排序（无 releaseDate 按 code ASC 兜底），计算当前位置
- [x] 3.2 渲染「第 N 部 / 共 M 部」位置信息及"上一部" / "下一部"跳转链接，边界状态（第一部/最后一部）禁用对应按钮
- [x] 3.3 在 `apps/movie-app/src/views/Player.vue` 中同步新增系列导航（复用相同逻辑），"下一部"跳转路径为 `/movie/:code/play`
- [x] 3.4 影片无系列（`series == null`）时不渲染导航区块

## 4. 前端：历史页"已看完"标记与筛选

- [x] 4.1 在 `apps/movie-app/src/views/History.vue` 中新增 `isWatched` computed 辅助函数（progress / duration ≥ 0.9，或 duration null 时 progress ≥ 3600）
- [x] 4.2 对已看完的历史记录显示"已看完 ✓"绿色徽标，替换进度条
- [x] 4.3 新增"全部 / 在看 / 已看完"三 tab 筛选，前端按状态过滤当前页数据
- [x] 4.4 筛选切换时重置分页到第 1 页

## 5. 单测

- [x] 5.1 为 genre fallback 逻辑新增 API 单测：验证 `merged < 4` 时触发 fallback，`>= 4` 时不触发
- [x] 5.2 验证 genres 为空时 fallback 静默跳过（不报错）
- [x] 5.3 验证 fallback 结果去重正确（不重复出现演员/系列已有影片）

## 6. 类型检查与验收

- [x] 6.1 运行 `apps/api` type-check 确认无类型错误
- [x] 6.2 运行 `apps/movie-app` vue-tsc 确认无类型错误
- [x] 6.3 运行全量单测确认通过（`apps/api` + `apps/movie-app`）
