## 1. 修复同步服务 — movie-player-sync

- [x] 1.1 在 `apps/api/src/routes/movies/services/sync.service.ts` 中，扩展 `SyncMovieDataOptions.movies` 数组元素类型，添加可选 `players?: Array<{ sourceName: string, sourceUrl: string, quality?: string, sortOrder?: number }>` 字段。完成标准：TypeScript 类型定义包含 players 字段且无编译错误
- [x] 1.2 在同文件 `syncMovieData()` 函数中，于影片 upsert 完成后增加 players 写入逻辑：仅当 `players` 非空时，先 `DELETE` 该影片现有 players，再批量 `INSERT`。完成标准：[movie-player-sync] REQ-2 和 REQ-3 满足
- [x] 1.3 players 写入使用独立 try-catch，失败时打印警告但不影响影片元数据写入。完成标准：[movie-player-sync] REQ-4 满足
- [x] 1.4 在写入前对 `players.sourceUrl` 去重，过滤空值。完成标准：[movie-player-sync] REQ-5 满足

## 2. 新增播放源补充脚本 — player-enrich-script

- [x] 2.1 创建 `packages/crawler/src/scripts/enrich-players.ts`，实现从 API 获取 `totalPlayers = 0` 的影片列表（调用 `GET /api/admin/movies?hasPlayers=false&limit=<N>`）。完成标准：[player-enrich-script] REQ-1 满足
- [x] 2.2 在脚本中使用 `JavDBStrategy.getMovieInfo()` 对每个影片 code 进行搜索，提取磁力链接（players）。完成标准：[player-enrich-script] REQ-2 满足
- [x] 2.3 对提取到的 players，调用 `apiClient.syncMovie()` 写入数据库（包含 `players` 字段）。完成标准：[player-enrich-script] REQ-3 满足
- [x] 2.4 支持 `--dry-run` 命令行参数，启用时只打印处理结果不写入。完成标准：[player-enrich-script] REQ-4 满足
- [x] 2.5 每次 JavDB 请求前 sleep 3-6 秒随机延迟。完成标准：[player-enrich-script] REQ-6 满足
- [x] 2.6 在 `packages/crawler/package.json` 中添加 `"crawl:enrich-players"` 脚本命令。完成标准：可通过 `pnpm crawl:enrich-players` 运行

## 3. Admin API 支持播放源筛选（前置）

- [x] 3.1 在 `apps/api/src/routes/admin/movies/index.ts` 的电影列表查询中，添加 `hasPlayers` 查询参数支持（`totalPlayers = 0` 过滤）。完成标准：`GET /api/admin/movies?hasPlayers=false` 返回无播放源的影片列表

## 4. 验证

- [x] 4.1 使用 sync API 为测试影片同步 players，确认 players 表写入成功（集成测试通过，`totalPlayers=2`，`hasPlayers=true` 过滤返回正确结果）
- [x] 4.1.1 单元测试：为 `syncMovieData()` 编写 12 个测试用例（基础同步、players 写入、去重、幂等、容错），全部通过
- [x] 4.1.2 集成测试：验证 `hasPlayers=false` 返回 142 部无播放源影片；`sync` + `hasPlayers=true` 过滤端到端验证通过；幂等写入（重复 sync 不累加）验证通过
- [x] 4.1.3 Bug Fix：写入 players 后同步更新 `movies.totalPlayers` 冗余计数字段（原实现漏掉此步骤）
- [x] 4.2 运行 `pnpm crawl:enrich-players --limit 5 --dry-run`，确认输出正确影片列表和磁力链接预览（需启动 Puppeteer 浏览器）
- [x] 4.3 电影详情页 players 列表显示正常（已有前端展示逻辑，代码层面已验证）
