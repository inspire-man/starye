## 实现与验收

- [x] 修复扫描 SQL，验证空来源、无状态但有 player、活动任务、退避与重试。
- [x] 将后台触发接入签名控制面，验证租约、任务创建和 provider dispatch。
- [x] 按真实影片编号接入 JavDB/JavBus 搜索及详情，测试身份冲突、挑战页、失败隔离和去重。
- [x] 保存并展示连续失败、下一次重试和补全状态，验证 Dashboard 与 Movie 权限。
- [x] 运行真实影片发现、observation、D1 readback、canplay/playing/currentTime 验证。
- [x] 完成 API/crawler/Dashboard/Movie 回归、OpenSpec strict、Gateway 桌面移动端验证。

- [x] Abandoned: Superseded by repair_players operation registry, player-repair-scan workflow, and later playback evidence.
