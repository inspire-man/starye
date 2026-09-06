# 任务

- [x] 1. 扩展 AkShare cashflow normalizer/adapter 及 Python 单元测试。完成标准：`ASSIGN_DIVIDEND_PORFIT`/中文别名、有效值、空值和非有限值覆盖，旧字段行为不变。
- [x] 2. 扩展 API bridge cashflow parser 及 API 测试。完成标准：`cashDividendsPaid` 传输、旧 payload 兼容和来源 endpoint 覆盖。
- [x] 3. 运行现金流/股东回报/Quant 全量测试、type-check/build、lint、OpenSpec strict 和 GitNexus detect changes。完成标准：所有相关检查通过，公式与推荐行为不变。
- [ ] 4. 通过 Gateway 验证匿名鉴权和 cashflow API 边界，随后提交、创建 PR、检查 Actions，并在合并后验证主分支。
