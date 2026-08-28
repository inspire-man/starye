## 1. 规格与诊断

- [x] 1.1 在 proposal 和 design 中记录 Actions run ID、失败特征、GitNexus 影响与生产 D1 事件序列
- [x] 1.2 在 capability spec 中定义 D1 批次边界与同身份 runner 5xx 重试场景

## 2. 漫画 D1 可靠性

- [x] 2.1 将 native chapter page 插入改为固定安全批次，并通过现有回退路径测试验证可读状态行为
- [x] 2.2 增加 native D1 fake-client 大页面集回归测试，验证每条插入语句处于安全变量边界

## 3. Runner 回调可靠性

- [x] 3.1 增加同一序列化请求身份的有界 5xx 重试与可注入延迟，验证 4xx 保持单次请求
- [x] 3.2 增加 runner-client 恢复、重试耗尽、请求体与签名字段不变的回归覆盖

## 4. 验证与交付

- [x] 4.1 运行 API/crawler 窄测试、类型检查、lint、`git diff --check` 和严格 OpenSpec 验证
- [ ] 4.2 仅暂存目标实现/spec 文件，运行 GitNexus staged 变更检测，提交、推送并创建 PR
- [ ] 4.3 合并后核验合并提交 Actions 与部署，删除本地/远端分支引用和额外工作树，并报告 D1 读回证据
