## ADDED Requirements
### Requirement: Reject invalid mapping pages
演员和厂商映射 SHALL 拒绝错误标题、错误正文和过短页面。
#### Scenario: Error page
- **WHEN** 来源返回 404/Not Found 或日文错误文案
- **THEN** 不写入映射表，继续既有索引流程或记录未匹配
### Requirement: Retry failed mappings
未匹配记录 SHALL 在 7 天内冷却，超过冷却时间允许再次尝试。
#### Scenario: Expired failure
- **WHEN** 未匹配记录最后尝试超过 7 天
- **THEN** 映射流程重新访问来源，不永久跳过
