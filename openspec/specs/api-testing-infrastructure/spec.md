# api-testing-infrastructure Specification

## Purpose
TBD - created by archiving change api-hono-rpc-refactor. Update Purpose after archive.
## Requirements
### Requirement: 配置 Vitest 测试环境

`apps/api` MUST 配置 Vitest 作为测试框架。

#### Scenario: 创建 Vitest 配置文件

- **WHEN** 创建 `apps/api/vitest.config.ts`
- **THEN** MUST 包含以下配置：
  - `test.globals: true`（启用全局测试函数）
  - `test.environment: 'node'`（使用 Node 环境）
  - `resolve.alias`（路径别名，与 tsconfig.json 一致）

#### Scenario: 安装测试依赖

- **WHEN** 初始化测试环境
- **THEN** `apps/api/package.json` MUST 包含以下 devDependencies：
  - `vitest`
  - `@vitest/coverage-v8`（可选，用于覆盖率报告）

#### Scenario: 添加测试脚本

- **WHEN** 配置 npm scripts
- **THEN** MUST 包含 `"test": "vitest"` 脚本
- **THEN** MUST 包含 `"test:coverage": "vitest --coverage"` 脚本（可选）

---

### Requirement: 提供测试工具函数

MUST 提供 `test/helpers.ts`，包含常用的 mock 工具函数。

#### Scenario: Mock Drizzle 数据库

- **WHEN** 测试需要 mock 数据库
- **THEN** MUST 提供 `createMockDb()` 函数
- **THEN** 返回对象 MUST 包含 `select`, `from`, `where`, `limit`, `offset`, `get` 等方法的 mock

#### Scenario: Mock Hono Context

- **WHEN** 测试 Handler 函数
- **THEN** MUST 提供 `createMockContext(overrides)` 函数
- **THEN** 返回对象 MUST 包含 `get`, `req`, `json` 等方法的 mock
- **THEN** MUST 支持通过 `overrides` 参数自定义返回值

---

### Requirement: Services 层测试覆盖率

Services 层的单元测试覆盖率 MUST ≥ 80%。

#### Scenario: 测试核心业务逻辑

- **WHEN** 编写 Services 层函数（如 `getMovies`）
- **THEN** MUST 为每个函数编写至少一个单元测试
- **THEN** 测试 MUST 覆盖主要分支和边界情况

#### Scenario: Mock 数据库查询

- **WHEN** 测试 Services 层
- **THEN** MUST 使用 `createMockDb()` mock 数据库
- **THEN** MUST 验证数据库方法的调用参数

#### Scenario: 测试文件位置

- **WHEN** 创建测试文件
- **THEN** 测试文件 MUST 位于 `__tests__/services/` 目录
- **THEN** 文件名 MUST 为 `<service-name>.test.ts`（如 `movie.service.test.ts`）

---

### Requirement: Handlers 层测试覆盖率

Handlers 层的单元测试覆盖率 MUST ≥ 60%。

#### Scenario: 测试 HTTP 处理逻辑

- **WHEN** 编写 Handler 函数（如 `getMovieList`）
- **THEN** MUST 为每个 Handler 编写至少一个单元测试
- **THEN** 测试 MUST 验证参数解析和响应格式化

#### Scenario: Mock Hono Context

- **WHEN** 测试 Handlers 层
- **THEN** MUST 使用 `createMockContext()` mock Hono Context
- **THEN** MUST 验证 `c.json()` 的调用参数

#### Scenario: 测试错误处理

- **WHEN** 测试异常场景
- **THEN** MUST 验证 Handler 抛出 `HTTPException`
- **THEN** MUST 验证错误状态码和错误消息

---

### Requirement: 测试隔离性

每个测试 MUST 独立运行，不依赖其他测试的状态。

#### Scenario: Mock 重置

- **WHEN** 测试开始前
- **THEN** MUST 使用 `vi.clearAllMocks()` 清除所有 mock 状态
- **THEN** 或在测试后使用 `afterEach` 钩子清理

#### Scenario: 避免共享状态

- **WHEN** 编写测试
- **THEN** 禁止在测试间共享可变对象
- **THEN** 每个测试 MUST 创建独立的 mock 实例

---

### Requirement: 测试命名规范

测试 MUST 遵循清晰的命名规范。

#### Scenario: describe 块命名

- **WHEN** 使用 `describe` 组织测试
- **THEN** MUST 使用被测函数或模块的名称（如 `describe('movie.service', ...)`）

#### Scenario: it/test 块命名

- **WHEN** 编写测试用例
- **THEN** MUST 使用 `应该...` 或 `当...时` 格式描述行为
- **THEN** 示例：`it('应该过滤成人内容', ...)`

---

### Requirement: 快速测试反馈

测试执行 MUST 快速，避免长时间等待。

#### Scenario: 避免真实网络请求

- **WHEN** 测试需要外部依赖
- **THEN** MUST 使用 mock 替代真实网络请求
- **THEN** 禁止在单元测试中调用真实 API

#### Scenario: 避免真实数据库

- **WHEN** 测试数据库查询
- **THEN** MUST 使用 mock 数据库
- **THEN** 禁止连接真实 D1 数据库（E2E 测试除外）

#### Scenario: 测试执行时间

- **WHEN** 运行单元测试套件
- **THEN** 完整测试 SHOULD 在 5 秒内完成（不含覆盖率报告）

