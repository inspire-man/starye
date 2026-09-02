# Quality

项目质量以可复核证据为准，不用单一分数替代判断。

## 默认门槛

- 相关单元、集成、类型检查、lint 和 build 通过。
- 浏览器路径经 Gateway 验证，不能只验证应用 dev port。
- Crawler、持久化或迁移改动包含 D1 authoritative readback。
- 外部数据同时区分执行、传输、内容完整性、存储和实际消费证据。
- 失败、缺失、过期和 pending 状态保持可见，不转换为成功或零值。

详细测试分层见 testing-strategy.md，当前阶段门槛见 ../.planning/STATE.md，生产运维规则见 ../RUNBOOK.md。
