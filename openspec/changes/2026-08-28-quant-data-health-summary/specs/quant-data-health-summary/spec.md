## Purpose

让 Quant 总览快速说明当前研究数据是否可用，并把数据完整性与信号/评分明确分开。

## ADDED Requirements

### Requirement: Summarize current data health

Quant 总览 MUST 基于当前工作区已经加载的观察池、同步状态、价值质量和股东回报结果展示数据健康摘要。摘要 MUST 显示每个数据域的状态和计数，并 MUST NOT 发起额外网络请求或修改任何持久化数据。

#### Scenario: Current data is fully available

- **WHEN** 观察池有标的、日线同步已完成且覆盖完整，价值质量和股东回报结果均为 ready
- **THEN** 总览显示数据健康为完整
- **AND** 三个数据域分别显示真实覆盖/完整计数
- **AND** 摘要不改变候选信号分、价值质量分或研究优先级

#### Scenario: Current data has partial coverage

- **WHEN** 至少一个数据域返回 partial 或 insufficient 数据
- **THEN** 总览显示部分可用
- **AND** 该数据域显示已完整、部分和数据不足的真实计数
- **AND** 缺失值保持为数据缺口，不以零值替代

### Requirement: Keep loading, failure and empty states distinct

数据健康摘要 MUST 区分读取中、读取失败、无观察池和已加载但数据不足。读取失败不得降级为空观察池或完整状态。

#### Scenario: One data source is still loading

- **WHEN** 价值质量或股东回报请求仍在进行
- **THEN** 对应数据域显示读取中
- **AND** 总览摘要保留读取中状态，已完成的其他域继续显示

#### Scenario: One data source fails

- **WHEN** 某个数据域请求失败而其他数据域成功
- **THEN** 对应数据域显示读取失败及可理解的状态
- **AND** 总览不显示完整
- **AND** 已成功加载的数据仍然可见

#### Scenario: Watchlist is empty

- **WHEN** 当前观察池为空
- **THEN** 总览显示待补数据并提示先加入观察池
- **AND** 不生成虚构的覆盖率或 provider 数据

### Requirement: Keep the summary accessible and responsive

数据健康区域 MUST 使用语义标题、列表项和可见状态标签；状态长文案 MUST 可以换行。在 390px 视口中数据健康区域不得产生横向溢出或遮挡其他总览内容。

#### Scenario: Render data health on a narrow viewport

- **WHEN** 总览在 390px 视口显示完整、部分和读取失败数据域
- **THEN** 数据域行可以单列排列并换行
- **AND** 文案和状态标签仍在各自容器内完整可读
