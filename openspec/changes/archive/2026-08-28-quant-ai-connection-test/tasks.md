## 1. Connection domain

- [x] 1.1 新增有界 AI 配置测试 domain，复用 endpoint URL 与 timeout 边界；完成标准：成功、缺 key、超时、上游失败和响应格式错误可区分，key 不进入 body/错误。
- [x] 1.2 增加 domain 单测；完成标准：请求模型、鉴权头、最小 body、计时和错误分类稳定。

## 2. API contract

- [x] 2.1 增加认证 `POST /api/quant/ai-config/test` 和响应解析；完成标准：只读取已保存配置、不持久化研究数据，API/client 字段一致。
- [x] 2.2 增加 route/client 集成测试；完成标准：成功读回元数据、失败不泄漏 key 且不新增 summary。

## 3. Quant settings surface

- [x] 3.1 增加已保存配置的测试连接按钮和状态反馈；完成标准：测试中防重复、成功/失败状态诚实、失败可重试。
- [x] 3.2 增加响应式与焦点样式；完成标准：390px 无横向溢出，key 输入框保持空白。

## 4. Verification

- [x] 4.1 运行 API/Quant 测试、type-check、lint 和 build；完成标准：受影响检查通过。
- [x] 4.2 运行 OpenSpec 严格验证和 GitNexus staged 变更检测；完成标准：只报告预期 AI/Quant 文件和流程。
- [x] 4.3 通过 Gateway 验证配置读取、测试按钮和不自动调用状态；完成标准：无 console error/warn，远端调用只发生在主动测试后。
