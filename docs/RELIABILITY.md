# Reliability

可靠性依赖明确的边界、可重复的命令和反馈闭环。

- 入口、target、run 和 attempt 必须显式可追踪。
- Crawler 失败、取消、重试和迟到回调必须保留历史状态，不复用旧 attempt。
- 修复通过 revision/CAS、receipt、readback 和实际消费层验证。
- 部署、迁移、回滚和 R2 cleanup 遵循 ../RUNBOOK.md。
- 发生一次 agent 或工程流程错误后，应优先补工具、检查或局部规则，避免同类错误再次发生。
