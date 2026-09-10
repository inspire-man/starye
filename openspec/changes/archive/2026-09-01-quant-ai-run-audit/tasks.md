## 1. 数据与仓储

- [x] 1.1 新增 `quant_ai_run_audit` schema/migration/index，并补 D1 结构、默认边界、用户级级联和 retention 测试。
- [x] 1.2 增加审计仓储的创建、列表和用户/研究运行隔离回读。

## 2. API 运行链

- [x] 2.1 将摘要 JSON/SSE 生成链记录成功、失败、取消、耗时和接收字符数。
- [x] 2.2 新增审计读取接口，并让摘要响应带最近一次审计信息。

## 3. Quant 页面

- [x] 3.1 扩展类型、客户端解析和研究详情加载审计历史。
- [x] 3.2 展示运行完整性信息，保持确定性结论、历史摘要和重试边界。

## 4. 验证

- [x] 4.1 补充 migration、repository、API、client 和组件测试，覆盖成功、失败、取消和跨用户读取。
- [x] 4.2 运行全量验证、OpenSpec strict、GitNexus staged 审计及 Gateway/390px 页面复核。
