## 设计

### API 边界

新增 `POST /api/quant/research/comparison`。请求只包含 `run_ids`，长度限定为 2 至 3，服务端使用当前 session 的 user id 逐个读取研究运行；缺少任一运行或运行属于其他用户时返回既有 `QUANT_NOT_FOUND`，不调用模型。接口不接受报告正文、模型、API key 或 prompt。

### 对比 domain

`generateQuantAiComparison` 接收已读取的 `{ run, report }[]` 和解密后的用户 AI 配置，复用现有 endpoint URL、timeout、鉴权头和上游错误分类边界，但使用独立的 `research-comparison-v1` 版本。prompt 为每只报告的白名单字段和证据摘要，最多保留 3 份报告、每份最多 32 条 evidence、每条说明有界截断。

### 响应结构与校验

响应只允许 `overview`、`commonGround`、`differences`、`risks`、`nextChecks` 和 `citedEvidence`。前四个/下一步数组最多 6 项；差异项必须带 `tsCode`、`point`、`evidenceKeys`；引用项必须带 `tsCode` 和 `evidenceKey`。服务端建立每只股票的 evidence 白名单，拒绝未知代码、未知 key、空文本、超长文本和交易指令词。成功响应同时返回版本、provider、model、生成时间及结构化结果，不写入 D1。

### 前端状态

对比抽屉仅在研究批次完成且至少 2 项成功时显示“AI 对比研究”。点击后显示读取中，重复点击被禁用；成功显示结果和可点击的股票证据标签，失败显示分类错误并允许重试。重新生成研究、切换候选或关闭抽屉时递增 request id，丢弃旧响应。

### 证据导航

点击 AI 引用或差异项的股票标签关闭对比抽屉，并调用现有 `selectStock` 打开该股票详情；详情重新从 API 读取研究历史，AI 对比响应不作为权威报告数据。

### 回滚

移除对比路由、domain、客户端方法和抽屉区域即可；已有单股研究摘要、批量摘要、导出、复制和确定性报告不受影响。
