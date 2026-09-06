## MODIFIED Requirements

### Requirement: provider 空报告必须与 provider 故障分开

Quant provider 收到合法的空报告响应时 MUST 返回空历史或空集合并保留其他字段；只有响应结构非法、请求超时或上游错误才返回 provider error code。空历史 MUST 在股东回报区域显示为数据不足，不得显示为来源不可用。Eastmoney 回购接口返回明确的空结果代码或空 result 时 MUST 按合法空历史处理。

#### Scenario: 现金流报告为空

- **WHEN** Eastmoney 现金流日期接口返回合法 JSON `null` 或明确空列表
- **THEN** 现金流历史为空，状态为 `insufficient_data`
- **AND** 股息、股本和回购证据继续独立计算

#### Scenario: 回购报告为空

- **WHEN** Eastmoney 回购接口返回稳定的空结果代码或 `result: null`，且响应结构仍是可识别的 provider 响应
- **THEN** 回购历史为空，回购证据状态为 `insufficient_data`
- **AND** 页面显示“暂无回购记录/数据不足”，不显示来源不可用或要求检查 provider 配置

#### Scenario: 回购 provider 真正失败

- **WHEN** Eastmoney 回购接口超时、返回非 JSON、响应结构损坏或发生未分类上游错误
- **THEN** 回购证据状态为 `unavailable` 并保留安全错误码
- **AND** 已成功的分红、现金流和股本证据继续返回

### Requirement: 行业不适用字段必须与来源缺失分开

Quant MUST preserve industry-specific financial fields returned by the source and MUST mark generic metrics that are not meaningful for banks, insurers, or other specialized financial industries as not applicable. Not-applicable fields MUST NOT be counted as missing evidence, source failure, or refreshable gaps. 判断就绪度 MUST 使用相同边界，不得因为这些字段的 `status=missing` 表示而阻断完整的行业专用证据链。

#### Scenario: 保险财报没有通用毛利率

- **WHEN** an insurance report returns solvency, net investment return, or new-business-value fields but no generic gross margin
- **THEN** the generic gross-margin evidence is marked not applicable
- **AND** the industry-specific fields remain visible with their source and report date
- **AND** factor health does not offer a generic financial refresh for that field

#### Scenario: 银行财报使用专用资本指标

- **WHEN** a bank report returns core-tier-one capital adequacy or net interest margin while generic debt and interest metrics are not comparable
- **THEN** the bank-specific fields are retained as financial evidence
- **AND** generic non-comparable fields do not reduce raw evidence coverage

#### Scenario: 行业不适用字段不阻断判断就绪度

- **WHEN** 报告的正权重因子完整、必要 evidence 均有值，但银行或保险通用 evidence 被标记为 `not_applicable`
- **THEN** 判断就绪度的数据完整性检查不把这些字段计为缺失或阻断原因
- **AND** 页面继续显示行业口径说明和其他需要人工核对的风险
