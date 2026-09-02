# Security

安全边界以 RUNBOOK.md 和代码中的鉴权 middleware 为准。

- Secret、cookie、JWT、认证 header 和原始 provider payload 不写入版本化文档。
- 远程操作必须经过显式 target profile 和 preflight。
- API、Gateway、后台和 crawler 的身份边界分别验证，不以隐藏 UI 代替鉴权。
- D1 migration、R2 storage、rollback 和生产操作遵循 ../RUNBOOK.md。
- 新的鉴权或数据边界变化必须通过 OpenSpec 记录并补契约测试。
