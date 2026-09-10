# quant-ai-connection-test Specification

## ADDED Requirements

### Requirement: Test the saved AI configuration

Quant MUST expose an authenticated `POST /api/quant/ai-config/test` operation that tests the current user's saved AI configuration with a bounded minimal request. The operation MUST NOT accept or return an API key, research report content, or AI summary record.

#### Scenario: Saved configuration responds successfully

- **WHEN** 当前用户有已保存的 provider、model 和可用 API key（Ollama 除外）
- **THEN** API 向配置 endpoint 的 chat completions 地址发送最小测试请求
- **AND** 返回 provider、model、测试时间和非负耗时
- **AND** 不新增研究运行或 AI 摘要持久化记录

#### Scenario: Configuration is missing or incomplete

- **WHEN** 当前用户没有已保存配置，或非 Ollama 配置没有 API key
- **THEN** API 返回可区分的配置错误
- **AND** 不发起上游请求

#### Scenario: Upstream fails or responds with an invalid shape

- **WHEN** endpoint 超时、返回非 2xx 或返回缺少最小 choices/message/content 结构的 JSON
- **THEN** API 返回对应的超时、上游或响应格式错误
- **AND** 不把上游正文或 API key 放入错误响应

### Requirement: Show connection outcome honestly

Quant AI 配置抽屉 MUST 提供测试已保存配置的操作，并区分测试中、成功和失败状态。测试失败时 MUST 保留可重试状态；测试成功时 MUST 只显示脱敏配置元数据，不显示 API key。

#### Scenario: Test a saved configuration from the drawer

- **WHEN** 用户点击“测试连接”
- **THEN** 页面调用测试接口并显示测试中状态
- **AND** 成功后显示模型和耗时，不改变配置表单或研究数据

#### Scenario: Retry after a failed test

- **WHEN** 测试返回配置、超时、上游或响应格式错误
- **THEN** 页面显示错误状态而不是成功状态
- **AND** 测试按钮恢复可用，用户可以再次测试

### Requirement: Do not auto-call the model

页面加载、打开配置抽屉和保存 AI 配置 MUST NOT 自动调用测试 endpoint 或外部模型；只有用户主动点击测试连接时才触发一次测试请求。

#### Scenario: Open or save the configuration

- **WHEN** 用户打开抽屉或保存 provider/model/Base URL/API key
- **THEN** 页面只读取或保存配置
- **AND** 不向模型 endpoint 发送探测请求
