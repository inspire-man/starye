# quant-batch-report-export Specification

## ADDED Requirements

### Requirement: Export completed batch research reports

Quant 候选对比抽屉 MUST 在当前批次至少包含一项成功研究运行且所有项目已经结束时，提供批量 Markdown 导出操作。导出内容 MUST 由当前成功运行按候选选择顺序组合生成，并通过浏览器本地下载；操作只读取当前批次内存状态。

#### Scenario: Export a fully successful batch

- **WHEN** 当前选中的 2 至 3 项研究全部成功返回
- **THEN** 批次区域显示包含成功数量的 Markdown 导出操作
- **AND** 操作下载一个包含全部成功研究报告的 Markdown 文件
- **AND** 文件中的报告顺序与当前候选选择顺序一致

#### Scenario: Export a partially successful batch

- **WHEN** 当前批次至少一项成功、至少一项失败且所有项目已经结束
- **THEN** 页面允许导出成功报告
- **AND** Markdown 文件标明成功数量、失败数量和失败股票代码
- **AND** 失败项目仍保留单项重试操作

#### Scenario: No completed report is available

- **WHEN** 批次仍在排队或生成、或所有项目均失败、或当前没有批次结果
- **THEN** 页面隐藏可执行的批量导出操作
- **AND** 页面不生成空下载文件

### Requirement: Preserve single-report content boundaries

批量 Markdown 中每份报告 MUST 复用现有单报告 formatter 的允许字段，包括状态、研究动作、分数、证据、阈值、来源、观察时间和数据缺口。批量导出 MUST 仅使用成功运行和失败股票代码等当前批次状态，不序列化运行对象的额外字段，也不改变研究历史、候选排序或研究标记。

#### Scenario: Reports contain optional fields

- **WHEN** 成功运行包含缺失值、可选证据或额外运行对象字段
- **THEN** 文件保留明确的数据缺口和允许的可选证据信息
- **AND** 额外字段不会出现在文件中

### Requirement: Batch export feedback remains honest and accessible

批量导出成功后页面 MUST 显示导出数量；浏览器生成文件失败时 MUST 显示失败状态并保留再次操作的能力。操作 MUST 具有可见文本、可访问名称、可见焦点和窄屏稳定布局；批量进行中操作保持禁用状态。

#### Scenario: Download generation fails

- **WHEN** 浏览器 Blob 或下载链接生成过程抛出错误
- **THEN** 页面显示可理解的失败状态
- **AND** 页面保留批次结果与单项重试状态

#### Scenario: Use the batch export action on a narrow screen

- **WHEN** 用户在 390px 视口打开候选对比抽屉
- **THEN** 批量研究和导出操作可以换行排列
- **AND** 抽屉内容没有横向溢出
