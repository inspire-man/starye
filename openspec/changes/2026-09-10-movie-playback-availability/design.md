# 设计

- 以现有 source disposition、playback evidence 和 players 行为基础，不把 EXISTS players 当成可播放。
- 详情页状态固定为：有播放源、未验证、验证失败、仅磁力、最近验证时间。
- 播放器失败后回写来源级原因和下一步动作；最近可播放列表只收录验证通过项。
- 管理端筛选未验证、验证失败和过期，不改变 repair 任务控制面。
