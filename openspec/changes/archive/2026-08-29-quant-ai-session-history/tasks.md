## 1. Specification and storage

- [x] 1.1 完成候选 AI 会话 proposal、design、delta spec；完成标准：strict OpenSpec 识别至少一项 ADDED requirement。
- [x] 1.2 新增 `quant_candidate_ai_session` schema、0044 migration、relations 和迁移测试；完成标准：字段、外键、索引、user 隔离和本地迁移 readback 通过。

## 2. API and persistence

- [x] 2.1 新增会话 repository：创建、读取、列表、追加追问和 10/10 裁剪；完成标准：所有写入完成 D1 readback，损坏/越权内容有 typed error。
- [x] 2.2 扩展候选简报/追问接口并新增历史列表/详情接口；完成标准：认证、当前快照/范围绑定、sessionId 响应、无 provider 误调用和集成测试通过。
- [x] 2.3 补 API schema/type-check 测试；完成标准：请求字段、响应字段、错误状态和 AppType 保持一致。

## 3. Quant surface

- [x] 3.1 扩展 Quant 类型和 client，解析历史列表/详情与 sessionId；完成标准：请求经 Gateway 前缀，客户端不发送密钥或候选事实。
- [x] 3.2 在候选简报面板展示历史、加载/空/错状态和只读恢复；完成标准：历史恢复不修改当前候选表、筛选或确定性字段。
- [x] 3.3 处理生成/追问/筛选/快照竞态并补 component tests；完成标准：旧范围响应不会覆盖当前状态，最新 10 条追问可见。

## 4. Verification and delivery

- [x] 4.1 运行 DB/API/Quant 测试、type-check、lint、build、migration/readback；完成标准：受影响检查全通过。
- [x] 4.2 运行 strict OpenSpec、GitNexus staged detection、diff check；完成标准：只报告会话历史相关 symbols/flows。
- [x] 4.3 通过 `http://localhost:8080/quant/` 验证历史 idle/list/restore 和无浏览器错误；完成标准：不触发真实 AI 请求，保留确定性数据证据。
- [x] 4.4 显式暂存功能文件，排除用户既有 `AGENTS.md`、`CLAUDE.md` 改动，提交、推送、PR、Actions 通过后合并并清理分支；完成标准：merge commit Actions 全绿。
