## ADDED Requirements

### Requirement: 提供 FilterBuilder 类

MUST 提供 `FilterBuilder` 类，用于构建动态 SQL 查询条件。

#### Scenario: 创建 FilterBuilder 实例

- **WHEN** 需要构建查询条件
- **THEN** MUST 能够创建 `new FilterBuilder()` 实例
- **THEN** FilterBuilder MUST 支持链式调用

#### Scenario: 添加等值条件

- **WHEN** 调用 `filter.eq(column, value)`
- **THEN** 如果 `value` 不为 `undefined`，MUST 添加 `eq(column, value)` 条件
- **THEN** 如果 `value` 为 `undefined`，MUST 忽略该条件
- **THEN** MUST 返回 `this` 以支持链式调用

#### Scenario: 添加模糊匹配条件

- **WHEN** 调用 `filter.like(column, value)`
- **THEN** 如果 `value` 为非空字符串，MUST 添加 `ilike(column, '%${value}%')` 条件
- **THEN** 如果 `value` 为空或 `undefined`，MUST 忽略该条件

#### Scenario: 添加范围条件

- **WHEN** 调用 `filter.between(column, min, max)`
- **THEN** 如果 `min` 不为 `undefined`，MUST 添加 `gte(column, min)` 条件
- **THEN** 如果 `max` 不为 `undefined`，MUST 添加 `lte(column, max)` 条件

#### Scenario: 构建最终 SQL 条件

- **WHEN** 调用 `filter.build()`
- **THEN** 如果有条件，MUST 返回 `and(...filters)`
- **THEN** 如果无条件，MUST 返回 `undefined`

---

### Requirement: 支持自定义 SQL 条件

FilterBuilder MUST 支持添加自定义 SQL 表达式。

#### Scenario: 添加自定义条件

- **WHEN** 调用 `filter.custom(sqlExpression)`
- **THEN** 如果 `sqlExpression` 不为 `undefined`，MUST 添加该条件
- **THEN** MUST 返回 `this` 以支持链式调用

#### Scenario: JSON 字段包含查询

- **WHEN** 调用 `filter.jsonContains(column, value)`
- **THEN** MUST 添加 `` sql`${column} LIKE '%${value}%'` `` 条件
- **THEN** 仅当 `value` 非空时添加条件

---

### Requirement: 提供分页助手函数

MUST 提供 `paginate` 函数，统一处理分页逻辑。

#### Scenario: 应用分页

- **WHEN** 调用 `paginate(query, { page: 2, pageSize: 20 })`
- **THEN** MUST 调用 `query.limit(20).offset(20)`
- **THEN** 页码从 1 开始计数

#### Scenario: 默认分页参数

- **WHEN** 未提供 `pageSize`
- **THEN** MUST 使用默认值 20

---

### Requirement: 类型安全

所有查询构建函数 MUST 保持 TypeScript 类型安全。

#### Scenario: 列类型推导

- **WHEN** 使用 `filter.eq(moviesTable.id, value)`
- **THEN** TypeScript MUST 检查 `value` 的类型与 `moviesTable.id` 一致

#### Scenario: 可选参数处理

- **WHEN** 传递 `undefined` 作为条件值
- **THEN** MUST 自动忽略该条件
- **THEN** 不应产生无效的 SQL 语句

---

### Requirement: 与 Drizzle ORM 集成

查询构建器 MUST 使用 Drizzle ORM 的 `SQL` 类型和操作符。

#### Scenario: 使用 Drizzle 操作符

- **WHEN** 构建条件
- **THEN** MUST 使用 `eq`, `ilike`, `gte`, `lte`, `and` 等 Drizzle 提供的操作符
- **THEN** 返回的 SQL 对象 MUST 与 Drizzle 查询 API 兼容

#### Scenario: SQL 注入防护

- **WHEN** 构建包含用户输入的查询
- **THEN** MUST 使用 Drizzle 的参数化查询
- **THEN** 禁止使用字符串拼接构建 SQL
