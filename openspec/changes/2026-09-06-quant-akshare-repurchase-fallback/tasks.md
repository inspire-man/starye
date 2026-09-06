# 任务

- [x] 1. 扩展 AkShare bridge contract、normalizer 和 adapter，输出按股票过滤的 `repurchases`，并补齐 Python 单元测试。完成标准：bridge 测试覆盖有效记录、空匹配、无效/错码行和上游失败，旧字段行为不变。
- [x] 2. 扩展 API bridge parser 和 AkShare repurchase provider。完成标准：bridge 响应严格解析可选 `repurchases`，记录日期/金额/数量校验通过，空集合映射为数据不足边界。
- [x] 3. 增加 Eastmoney → AkShare repurchase provider chain 并接入 Quant handler。完成标准：空历史、主源错误、回退成功、回退为空和两端错误均有测试，provider metadata 与安全错误码正确。
- [x] 4. 扩展 API schema、Quant view model/client parser 与研究报告来源。完成标准：`akshare` 能通过 schema/type-check，旧 Eastmoney/Tushare payload 仍可解析，报告来源与实际 provider 一致。
- [x] 5. 运行 bridge/API/Quant 定向测试、type-check/build、OpenSpec strict 和 GitNexus detect changes。完成标准：所有相关检查通过且变更范围符合预期。
- [ ] 6. 通过 Gateway 验证认证边界、AkShare 回购数据、无匹配空历史和来源展示，随后提交、创建 PR、检查 Actions，并在合并后验证主分支。
