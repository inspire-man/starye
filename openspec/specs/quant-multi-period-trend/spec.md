# quant-multi-period-trend Specification

## Purpose
TBD - created by archiving change 2026-08-24-quant-multi-period-trend. Update Purpose after archive.

## Requirements

### Requirement: 动作列布局稳定

共享 DataTable 的动作容器 MUST 让直接按钮和链接按自身内容宽度排列；自定义动作组容器可以占满动作单元格。Quant 观察池删除按钮 MUST 保持固定尺寸、右对齐、垂直居中，且按钮文本或图标状态变化不得改变列宽。

#### Scenario: 观察池操作按钮

- **WHEN** 观察池表格在桌面或 390px 宽度下渲染
- **THEN** 删除按钮保持固定触控尺寸并与“操作”列对齐
- **AND** 页面与表格滚动区域不出现额外横向溢出

### Requirement: 多周期趋势结构

Quant 工作台 MUST 使用当前选中股票已加载的日线计算 5、20、60 个交易日表现、最新价相对 20 日均线的位置和 60 日窗口回撤。任一窗口历史不足或价格缺失时，对应指标 MUST 返回 `null`，不得用零或插值填充。

#### Scenario: 完整日线窗口

- **WHEN** 当前股票至少有 61 根有效收盘价
- **THEN** 详情区域展示 5/20/60 日表现、均线距离和 60 日回撤
- **AND** 结构结论根据多周期方向与均线关系显示为易懂文本

#### Scenario: 历史窗口不足

- **WHEN** 当前股票缺少某个所需历史窗口
- **THEN** 该周期显示暂无数据
- **AND** 其他已有周期继续展示

#### Scenario: 研究边界

- **WHEN** 用户阅读多周期趋势结构
- **THEN** 页面标注指标仅用于观察当前价格结构，不代表未来收益
