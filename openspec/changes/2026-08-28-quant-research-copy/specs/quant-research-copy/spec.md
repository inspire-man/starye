# quant-research-copy Specification

## ADDED Requirements

### Requirement: Copy the current research report

Quant 工作台 MUST 在当前股票存在已加载研究报告时提供复制 Markdown 操作。复制内容 MUST 使用当前页面已加载的结构化研究报告和可选 AI 摘要，与同一时刻的 Markdown 下载内容一致；复制操作 MUST NOT 发起网络请求或修改研究运行、候选评分、研究标记和排序。

#### Scenario: Copy a report with an AI summary

- **WHEN** 当前股票有研究报告且页面已加载 AI 摘要
- **THEN** 页面显示复制 Markdown 操作
- **AND** 操作将报告和该摘要写入剪贴板
- **AND** 写入内容与当前报告导出 formatter 生成的 Markdown 一致

#### Scenario: Copy a report without an AI summary

- **WHEN** 当前股票有研究报告但没有 AI 摘要
- **THEN** 页面显示复制 Markdown 操作
- **AND** 操作只复制当前结构化研究报告，不等待或请求 AI 摘要

#### Scenario: No report is available

- **WHEN** 研究历史正在加载、加载失败或当前没有研究报告
- **THEN** 页面不显示可执行的复制操作
- **AND** 页面不写入剪贴板

### Requirement: Report clipboard outcome honestly

复制操作 MUST 在剪贴板写入成功后显示成功状态；浏览器不支持剪贴板、用户拒绝权限或写入过程抛错时 MUST 显示失败状态，且 MUST NOT 显示成功状态。写入进行中 MUST 防止同一操作重复提交。

#### Scenario: Clipboard write succeeds

- **WHEN** 浏览器接受当前 Markdown 写入
- **THEN** 页面显示复制成功状态
- **AND** 当前研究报告、AI 摘要和详情抽屉状态保持不变

#### Scenario: Clipboard write is unavailable or rejected

- **WHEN** 浏览器没有可用的 `navigator.clipboard.writeText`，或写入 Promise 失败
- **THEN** 页面显示可理解的复制失败状态
- **AND** 页面不显示复制成功状态
- **AND** 用户可以再次执行复制操作

### Requirement: Copy controls remain accessible on narrow screens

复制操作 MUST 使用现有 Quant 报告操作区的可见焦点、可访问名称和稳定布局；在 390px 视口中操作文本 MUST 不溢出或遮挡报告内容。

#### Scenario: Use the copy action with keyboard focus

- **WHEN** 用户通过键盘聚焦复制操作
- **THEN** 操作显示可见焦点状态并具有描述复制用途的 accessible name

#### Scenario: Render the report action area on a narrow viewport

- **WHEN** 页面在 390px 视口显示已有报告
- **THEN** 生成、复制和下载操作可以换行排列
- **AND** 操作区不产生横向滚动
