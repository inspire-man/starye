## ADDED Requirements
### Requirement: Consistent filter surfaces
运管筛选面板 SHALL 保持高级区域与常用区域间距，输入、日期、下拉 SHALL 使用同一背景与焦点规则。
#### Scenario: Expanded advanced filters
- **WHEN** 用户展开高级筛选
- **THEN** 高级字段与常用字段之间存在独立分隔和间距
#### Scenario: Date range at narrow width
- **WHEN** 用户在窄屏使用日期区间
- **THEN** 输入框可收缩，不撑出筛选容器
