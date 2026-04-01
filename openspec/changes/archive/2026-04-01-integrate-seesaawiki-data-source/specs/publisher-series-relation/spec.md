## ADDED Requirements

### Requirement: 系统 SHALL 提取厂商系列关系

系统 **MUST** 从 SeesaaWiki 厂商页面提取系列关系信息，**SHALL** 识别母公司、子品牌和系列标签，**MUST** 存储到数据库的 `parentPublisher` 和 `brandSeries` 字段。

#### Scenario: 提取母公司关系
- **WHEN** 厂商页面包含 "KMP系1レーベル" 或 "◯◯株式会社の子会社" 标注
- **THEN** 系统识别母公司名称，存储到 `parentPublisher` 字段

#### Scenario: 提取品牌系列标签
- **WHEN** 厂商页面包含 "Premium系列" 或 "総合メーカー" 等标签
- **THEN** 系统提取标签，存储到 `brandSeries` 字段（多个标签以逗号分隔）

#### Scenario: 处理复杂系列描述
- **WHEN** 厂商页面包含详细的系列描述（如"KMP系1レーベルの1つで、主に熟女作品を扱う"）
- **THEN** 系统提取关键信息：母公司"KMP"、系列特征"熟女作品"，存储到对应字段

#### Scenario: 处理无系列关系
- **WHEN** 厂商页面未包含系列关系信息（独立厂商）
- **THEN** 系统将 `parentPublisher` 和 `brandSeries` 设置为 null

### Requirement: 系统 SHALL 支持系列关系查询

系统 **SHALL** 提供 API 端点查询厂商的系列关系，**MUST** 支持正向查询（子品牌列表）和反向查询（母公司）。

#### Scenario: 查询子品牌列表
- **WHEN** 用户查询 "KMP" 的子品牌
- **THEN** 系统返回所有 `parentPublisher = "KMP"` 的厂商列表

#### Scenario: 查询母公司
- **WHEN** 用户查询 "REAL" 的母公司
- **THEN** 系统返回 `parentPublisher` 字段值（如 "KMP"）

#### Scenario: 查询同系列厂商
- **WHEN** 用户查询 "Premium系列" 的所有厂商
- **THEN** 系统返回所有 `brandSeries` 包含 "Premium系列" 的厂商

#### Scenario: 处理多级系列关系
- **WHEN** 存在多级关系（如 A → B → C）
- **THEN** 系统仅存储直接父级关系，不递归查询祖先

### Requirement: 系统 SHALL 在 Dashboard 中展示系列关系

系统 **SHALL** 在管理后台的厂商详情页展示系列关系，**MUST** 显示母公司链接和子品牌列表，**SHALL** 支持可视化展示。

#### Scenario: 展示母公司链接
- **WHEN** 管理员查看子品牌详情页
- **THEN** 系统显示 "母公司: [KMP]"（可点击跳转到 KMP 详情页）

#### Scenario: 展示子品牌列表
- **WHEN** 管理员查看母公司详情页
- **THEN** 系统显示 "子品牌: [REAL, BIGMORKAL, ...]"（列表可点击）

#### Scenario: 展示品牌系列标签
- **WHEN** 管理员查看厂商详情页
- **THEN** 系统显示 "系列标签: Premium系列, 熟女专门" 等标签

#### Scenario: 可视化系列关系图（可选）
- **WHEN** 管理员点击 "查看系列关系图"
- **THEN** 系统展示树状或图状结构，显示完整的厂商关系网络

### Requirement: 系统 SHALL 处理系列关系变更

系统 **MUST** 支持系列关系的更新和历史记录，**SHALL** 处理厂商被收购、品牌重组等情况。

#### Scenario: 更新系列关系
- **WHEN** SeesaaWiki 更新了厂商的系列关系（如被新公司收购）
- **THEN** 系统在重新爬取时更新 `parentPublisher` 字段

#### Scenario: 记录历史关系（可选）
- **WHEN** 厂商的母公司发生变更
- **THEN** 系统可选记录历史关系到单独的表（future enhancement）

#### Scenario: 处理品牌终止
- **WHEN** 厂商页面标注 "已停止活动" 或 "已合并到其他品牌"
- **THEN** 系统更新 `isActive` 字段，保留系列关系信息

### Requirement: 系统 SHALL 验证系列关系一致性

系统 **SHALL** 检查系列关系的数据一致性，**MUST** 检测孤儿引用和循环依赖，**SHALL** 输出警告日志。

#### Scenario: 检测孤儿引用
- **WHEN** 厂商 A 的 `parentPublisher = "B"`，但数据库中不存在厂商 B
- **THEN** 系统记录警告日志："厂商 A 引用了不存在的母公司 B"

#### Scenario: 检测循环依赖
- **WHEN** 厂商 A 的母公司是 B，B 的母公司是 A（不应发生）
- **THEN** 系统检测到循环依赖，记录错误日志，断开其中一个关系

#### Scenario: 运行一致性检查
- **WHEN** 管理员运行数据一致性检查工具
- **THEN** 系统遍历所有厂商，检查系列关系的完整性，输出问题报告
