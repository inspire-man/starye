# Capability: movie-advanced-filter-panel

## Purpose
TBD: Generated during movie-discovery-enhancement change.

## Requirements

### Requirement: 首页高级筛选面板（inline 展开）
首页 `Home.vue` MUST 在 Genre 标签栏下方提供常驻的高级筛选区块，包含年份范围和时长分段选择，状态同步到 URL query。

- 高级筛选区块 MUST 默认展示（inline 常驻），不需要额外点击展开
- 区块 MUST 包含：年份范围（from / to 两个 number input）和时长分段（按钮组）
- 任一筛选条件变化时 MUST 触发影片列表重新请求（重置分页到第 1 页）
- 所有已激活的筛选条件 MUST 同步写入 URL query，刷新后 MUST 恢复
- 所有条件为空/默认时 MUST 不写入 URL query，保持 URL 整洁

#### Scenario: 选择年份范围筛选
- **WHEN** 用户在 yearFrom 输入框填入 `2024`，yearTo 输入框填入 `2025`
- **THEN** MUST 触发影片列表请求（含 `yearFrom=2024&yearTo=2025` 参数），分页重置为第 1 页

#### Scenario: 仅填写 yearFrom 单侧
- **WHEN** 用户填入 yearFrom=2024，yearTo 为空
- **THEN** MUST 请求 `yearFrom=2024`（无 yearTo），展示 2024 年至今的影片

#### Scenario: 选择时长分段
- **WHEN** 用户点击"中等（60-120分）"按钮
- **THEN** MUST 触发请求（含 `durationMin=60&durationMax=120`），对应按钮高亮激活

#### Scenario: 清除时长分段
- **WHEN** 用户再次点击已激活的时长按钮
- **THEN** MUST 取消时长筛选，按钮恢复未激活态，重新请求不含时长参数

#### Scenario: URL 状态恢复
- **WHEN** 用户访问 `/?yearFrom=2024&duration=short`
- **THEN** 页面初始化时 MUST 激活对应的年份和时长筛选，并以这些参数请求影片列表

#### Scenario: 清除所有高级筛选
- **WHEN** 用户清空 yearFrom 和 yearTo，且时长为"不限"
- **THEN** URL query MUST 不含年份和时长参数，影片列表恢复完整结果

---

### Requirement: 时长分段枚举
时长按钮组 MUST 提供以下固定分段，与 API 的 durationMin/durationMax 参数对应。

| 按钮标签 | durationMin | durationMax |
|----------|-------------|-------------|
| 不限     | —           | —           |
| 短片（< 60分） | —      | 59          |
| 中等（60-120分） | 60   | 120         |
| 长片（> 120分）  | 121  | —           |

- "不限" MUST 为默认选中态，且 MUST 不传 durationMin/durationMax 参数
- 同一时刻只能激活一个时长分段，MUST 互斥

#### Scenario: 默认为"不限"
- **WHEN** 页面初次加载，URL 无时长参数
- **THEN** "不限"按钮 MUST 为激活态，其余按钮为未激活态

#### Scenario: 切换时长分段互斥
- **WHEN** 当前激活"中等（60-120分）"，用户点击"长片（> 120分）"
- **THEN** "中等"按钮 MUST 变为未激活，"长片"MUST 变为激活，请求携带 `durationMin=121`（无 durationMax）
