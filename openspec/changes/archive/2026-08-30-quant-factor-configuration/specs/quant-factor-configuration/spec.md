# 因子配置与来源可见

## ADDED Requirements

### Requirement: 用户级因子权重配置

系统 MUST 为每个用户维护一份五因子权重配置，包含 `trend`、`valuation`、`quality`、`shareholder-return` 和 `risk`；未保存时 MUST 返回现有默认权重 0.25、0.20、0.20、0.15、0.20。

#### Scenario: 首次读取使用默认配置

- **WHEN** 已认证用户没有 `quant_factor_config` 行并请求因子配置
- **THEN** API 返回 `source=default`、`updatedAt=null`，且五项权重总和为 1

#### Scenario: 保存后只影响当前用户

- **WHEN** 用户 A 保存一组合法权重
- **THEN** API 从 D1 读回并返回 `source=user` 的同一组权重，用户 B 仍读取自己的配置或默认配置

### Requirement: 权重边界与恢复默认

系统 MUST 拒绝负数、非有限数、未知因子 key 或总和不接近 1 的权重；系统 MUST 支持删除用户配置并恢复默认值。

#### Scenario: 非法权重不落库

- **WHEN** 请求包含负数、NaN、Infinity 或总和不为 1 的权重
- **THEN** API 返回稳定的输入错误，D1 中当前用户的合法配置保持不变

#### Scenario: 恢复默认保留历史报告

- **WHEN** 用户删除因子配置
- **THEN** API 返回默认配置，既有研究报告 JSON 和生成时间保持不变

### Requirement: 配置参与报告和推荐

新生成报告 MUST 使用读取到的用户配置计算因子分数、覆盖度和确定性推荐，并在 `factorModel.configuration` 保存版本、权重、来源和保存时间快照。权重为 0 的因子 MUST 不阻断有效数据判断，但 MUST 继续出现在来源列表中。

#### Scenario: 配置改变确定性分数

- **WHEN** 同一份证据使用两组不同的合法权重生成报告
- **THEN** `factorModel.factors[].weight`、总分或覆盖度按对应配置变化，且报告快照能区分两组配置

#### Scenario: 历史报告兼容

- **WHEN** API 读取缺少 `factorModel.configuration` 的历史报告
- **THEN** 报告、AI 摘要、问题和对比接口仍能正常返回，不为历史记录补写当前配置

### Requirement: 配置和来源在 Quant 界面可见

Quant 页面 MUST 提供可访问的配置入口，展示五类因子的当前权重、配置来源和保存状态；研究详情 MUST 同时展示因子真实来源、因子状态和配置版本。保存配置后页面 MUST 明确提示需要重新生成报告。

#### Scenario: 移动端编辑配置

- **WHEN** 用户在 390px 宽度打开配置入口
- **THEN** 五个因子控件和保存/恢复动作不发生横向溢出，键盘和屏幕阅读器可识别每个控件

## MODIFIED Requirements

无。
