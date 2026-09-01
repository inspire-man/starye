## 1. 事件与服务端

- [x] 1.1 为 AI transport 和摘要生成增加增量回调，保持当前完整内容校验与错误分类。
- [x] 1.2 新增用户隔离的摘要 SSE 路由，发送生命周期事件并仅在最终写入成功后发送 `completed`。

## 2. 客户端与界面

- [x] 2.1 在 Quant API client 增加 SSE 帧解析、事件校验和最终摘要解析。
- [x] 2.2 在研究摘要组件显示模式、接收进度和失败重试边界，保持移动端布局。

## 3. 验证

- [x] 3.1 补充 transport、路由、客户端和组件测试，覆盖分段、完整、失败与无持久化场景。
- [x] 3.2 运行 API/Quant/DB 验证、type-check、lint、build、OpenSpec strict，并通过 Gateway 页面复核页面链路。
