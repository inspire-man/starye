# 重点候选快捷提问

## ADDED Requirements

### Requirement: Focus candidates expose a scoped prompt action

每个当前 AI 简报的重点候选 MUST 提供一个与详情按钮同级的快捷追问按钮。快捷按钮 MUST 使用该候选的名称和 `tsCode` 生成问题，并沿用当前候选事实范围；详情按钮 MUST 继续触发已有的候选详情聚焦行为。

#### Scenario: Current briefing has focus candidates

- **WHEN** 当前简报成功且返回重点候选
- **THEN** 每个重点候选同时显示详情控件和“针对提问”快捷控件
- **AND** 两个控件为普通容器内的同级按钮，不得互相嵌套

#### Scenario: Candidate name is empty or long

- **WHEN** 重点候选名称为空或生成的问题内容较长
- **THEN** 快捷问题仍包含候选代码，并由现有输入边界限制为最多 500 个字符

### Requirement: Prompt action fills but does not submit

重点候选快捷按钮 MUST 复用现有追问输入更新和聚焦行为，MUST 更新追问输入框并将焦点放到该输入框；MUST NOT 自动提交追问或改变当前简报和确定性候选数据。

#### Scenario: User uses a focus candidate prompt

- **WHEN** 用户点击重点候选的快捷追问按钮
- **THEN** 当前追问输入框填入针对该候选的固定问题并获得焦点
- **AND** 在用户点击提交前不得触发 `askQuestion`

### Requirement: Prompt action respects unavailable states

快捷追问按钮 MUST 在当前候选事实不可追问、追问正在加载或 AI 能力不可用时保持 disabled，并 MUST 保留现有详情按钮和简报内容的可读性。

#### Scenario: Question flow is unavailable or loading

- **WHEN** 可追问候选为空、组件不可用或已有追问正在加载
- **THEN** 重点候选快捷按钮处于 disabled 状态
- **AND** 详情按钮仍保持独立的当前行为

### Requirement: Focus prompt layout remains readable on narrow screens

重点候选快捷操作 MUST 在窄屏下切换为可读的单列布局。候选名称、代码、解释和操作按钮 MUST 在各自区域内换行或收缩，不得与相邻内容重叠或产生横向溢出。

#### Scenario: Quant briefing is rendered on a narrow viewport

- **WHEN** 简报面板在移动宽度下渲染重点候选
- **THEN** 详情按钮和快捷按钮仍可通过键盘访问，长文本保持在面板边界内
