# 任务

- [x] 1. 扩展 AkShare bridge contract、normalizer、adapter 和 Python 单元测试。完成标准：实施/预案、每十股金额转换、日期空值、空历史、错误码和 endpoint source 均覆盖，旧 fields 行为不变。
- [x] 2. 扩展 API bridge parser、AkShare dividend provider 和 dividend chain。完成标准：`akshare` provider 类型可通过 type-check，Tushare/Eastmoney 空/失败、AkShare 命中、双空和双失败均有测试，最多一次 bridge fallback。
- [x] 3. 扩展 shareholder-return schema、研究报告来源、Quant client parser 和 UI 来源文案。完成标准：实际 provider/fallback metadata 贯穿详情与报告，旧 bridge payload 仍可解析，股息率公式不变。
- [x] 4. 运行 bridge/API/Quant 定向测试、type-check/build、OpenSpec strict 和 GitNexus detect changes。完成标准：所有相关检查通过，HIGH 扇出变更范围符合预期。
- [x] 5. 通过 Gateway 验证匿名鉴权、AkShare 分红 fixture 来源展示与研究报告来源，随后提交、创建 PR、检查 Actions，并在合并后验证主分支。
