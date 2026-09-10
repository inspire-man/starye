## 1. 配置与迁移

- [x] 1.1 扩展 `quant_ai_config` schema 与 D1 migration，默认流式模式和 5 分钟预算，并用迁移测试验证字段、默认值和旧配置回读。
- [x] 1.2 扩展 AI 配置 domain、Valibot request/response schema 与路由，验证用户隔离、5-10 分钟边界和部署上限。

## 2. AI transport 与服务端调用

- [x] 2.1 在共享 AI transport 增加 SSE 增量解析、JSON 兼容路径、完成原因和 524 timeout 分类，并补单元测试覆盖标准、空、半截和超长响应。
- [x] 2.2 让摘要、提问、对比、候选简报和决策助手读取配置运行参数，补 API 集成测试验证请求体、预算和失败后无持久化。

## 3. Quant 设置界面

- [x] 3.1 扩展 Quant 类型与客户端解析，显示并保存响应模式、用户预算和配置校验错误。
- [x] 3.2 在 AI 配置抽屉提供模式/预算控件，并验证未保存状态、连接测试、超时提示和 390px 无横向溢出。

## 4. 交付验证

- [x] 4.1 运行 API/DB/Quant 定向与全量测试、type-check、lint、build、OpenSpec strict 和 GitNexus 变更审计。
- [x] 4.2 通过 `http://localhost:8080/quant/#candidates` 回读已登录配置和研究详情，确认确定性结论、数据缺口、AI 失败原因及重试入口均保持可见。
