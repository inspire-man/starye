## ADDED Requirements
### Requirement: Report invalid mapping URLs
映射质量接口 SHALL 报告映射表中协议非法或 URL 无法解析的条目数量。
#### Scenario: Invalid URL
- **WHEN** R2 演员映射表包含非 HTTP(S) 或无效 URL
- **THEN** `invalidMappingCount` 增加对应数量
#### Scenario: Valid URL
- **WHEN** 映射 URL 为可解析的 HTTP(S) 地址
- **THEN** 不计入非法数量
