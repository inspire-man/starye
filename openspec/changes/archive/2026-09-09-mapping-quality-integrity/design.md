## Decisions
逐项解析演员和厂商映射表的 `wikiUrl`；协议仅允许 `http:`/`https:`，解析异常计为非法。R2 文件缺失或读取失败沿用已有降级行为，不推断失效。
## Validation
API type-check、ESLint、GitNexus staged 检查；真实 R2 数据只读验证。
