## ADDED Requirements

### Requirement: 历史页"已看完"视觉标记
观看历史页面 MUST 对 `progress / duration ≥ 0.9`（或 duration 为 null 时 progress ≥ 3600 秒）的记录显示"已看完"徽标，帮助用户区分未完成与已完成的影片。

- MUST 在影片封面或标题旁显示"已看完 ✓"徽标（绿色系）
- progress / duration < 0.9 的记录 MUST 不显示该徽标（显示进度条）
- 徽标计算逻辑 MUST 为纯前端 computed，不调用后端接口
- duration 为 0 或 null 时，MUST 用 progress ≥ 3600（秒，约 60 分钟）作为兜底判断

#### Scenario: 已看完的记录显示徽标
- **WHEN** 某记录 `progress / duration = 0.95`
- **THEN** MUST 显示"已看完 ✓"徽标，不显示进度条

#### Scenario: 未看完的记录显示进度条
- **WHEN** 某记录 `progress / duration = 0.60`
- **THEN** MUST 显示进度条（60%），不显示"已看完"徽标

#### Scenario: duration 为 null 时的兜底
- **WHEN** 某记录 `duration = null`，`progress = 4200`（秒）
- **THEN** MUST 显示"已看完 ✓"徽标（progress ≥ 3600）

### Requirement: 历史页按观看状态筛选
历史页 MUST 提供"全部 / 在看 / 已看完"三个 tab，用户 MUST 能按完成状态筛选记录。

- "全部"tab：MUST 显示所有历史记录
- "在看"tab：MUST 仅显示 `progress / duration < 0.9` 的记录
- "已看完"tab：MUST 仅显示 `progress / duration ≥ 0.9` 的记录
- 筛选 MUST 在前端进行，不新增 API 参数

#### Scenario: 切换到"已看完"tab
- **WHEN** 用户点击"已看完"tab
- **THEN** 列表 MUST 仅展示进度 ≥ 90% 的记录，其余记录隐藏

#### Scenario: 切换到"在看"tab
- **WHEN** 用户点击"在看"tab
- **THEN** 列表 MUST 仅展示进度 < 90% 的记录
