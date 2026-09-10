## Implementation
- [x] 1.1 统计 R2 演员和厂商映射非法 URL。
## Verification
- [x] 2.1 API type-check、ESLint、GitNexus 检查通过。
- [x] 2.2 OpenSpec strict 与生产只读接口验证通过。

补充验证：上一提交 Actions 的 CI、Deploy API、Deploy API After PR Merge 全部成功。

附加改进：电影运管 `hasPlayers` 筛选使用 `players` 表的实时 `EXISTS/NOT EXISTS`，避免过期的 `totalPlayers` 汇总字段掩盖真实播放源状态；电影管理分析测试 10 项通过，API type-check 通过。
