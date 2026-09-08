## Decisions
新增统一页面可用性判定，拒绝 404/Not Found/日文错误标记及少于 80 字正文。未匹配记录保留并按 7 天冷却跳过，过期记录重新执行现有精确和索引流程。
## Validation
通过本地 Page fixture 测试、Crawler 类型检查和 ESLint；实际来源访问仍作为独立诊断。
