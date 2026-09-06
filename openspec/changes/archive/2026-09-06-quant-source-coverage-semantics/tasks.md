## 1. Provider 状态

- [x] 1.1 将 Eastmoney 回购稳定空响应规范化为空历史，并保留未知坏响应的错误映射；provider 测试 44/44 覆盖空响应、有效计划和真实失败路径。
- [x] 1.2 验证股东回报 domain 在空回购历史下返回 `insufficient_data`，不覆盖分红、现金流和股本证据；domain/route 定向测试 28/28 通过。

## 2. Quant 就绪度

- [x] 2.1 让判断就绪度过滤 `not_applicable` evidence；就绪度测试 9/9 覆盖银行/保险适用性和 optional 缺失不阻断。
- [x] 2.2 API/Quant 定向测试、type-check 和 build 已通过；Gateway 确认推荐与 100% 因子覆盖保持不变。

## 3. 验收与交付

- [x] 3.1 OpenSpec strict 通过；GitNexus re-index 后 detect_changes 只定位回购读取与就绪度检查流程，风险范围符合预期。
- [x] 3.2 Gateway `http://localhost:8080/quant/` 已验证 000001.SZ：行业不适用不再阻断就绪度，空回购显示“回购计划不足/数据缺口”而非来源不可用；页面日志无 error/warn。
