## Context

当前 `apps/api` 的主要问题：

1. **类型推导断裂**：路由模块使用 `const movies = new Hono<AppEnv>()` 后通过 `movies.get()` 添加路由，再 `export default movies`，但在 `index.ts` 中使用 `app.route('/movies', moviesRoutes)` 时，类型推导链断裂，无法导出完整的 `AppType`
2. **职责混乱**：`movies.ts`（998 行）混合了路由定义、HTTP 处理、业务逻辑、数据库查询、权限校验等多种职责
3. **重复逻辑**：`checkIsAdult`、分页参数解析、过滤条件构建在多个路由中重复实现
4. **测试缺失**：核心业务逻辑无单元测试，重构时缺乏安全网

**技术约束**：
- Cloudflare Workers 环境（无 Node.js 内置模块，使用 wrangler 构建）
- 不能修改 `apps/api` 的构建流程（`noEmit: true`，由 wrangler 处理）
- Dashboard 需要通过 `hc<AppType>()` 获取类型安全的 API 客户端

## Goals / Non-Goals

**Goals:**
- 实现完整的 Hono RPC 类型推导（Dashboard 可通过 `hc<AppType>()` 获得端到端类型安全）
- 建立清晰的三层架构（Routes → Handlers → Services），实现关注点分离
- 提取通用查询构建器，减少重复代码
- 为 Services 层和 Handlers 层建立单元测试（覆盖率 60%+）
- 渐进式迁移（先重构 `movies` 模块，验证后再推广）

**Non-Goals:**
- 不修改 API 接口（路径、参数、响应结构保持兼容）
- 不使用 TypeScript Project References（避免与 wrangler 构建冲突）
- 不重构其他模块的业务逻辑（仅重构 `movies`，其他模块后续迁移）
- 不添加新的运行时依赖（仅开发时依赖 Vitest）

## Decisions

### 决策 1: 类型共享方案 - 创建 `packages/api-types`

**问题**: 如何让 Dashboard 访问 `apps/api` 的 `AppType`，同时不干扰 Cloudflare Workers 构建？

**方案对比**:

| 方案 | 优势 | 劣势 | 结论 |
|------|------|------|------|
| A: TypeScript Project References | IDE 支持好，自动推导 | 需修改构建流程，与 wrangler 冲突 | ❌ 不采用 |
| B: 创建 `packages/api-types` | 零构建依赖，兼容现有流程 | 需手动维护类型导出 | ✅ **采用** |

**决定**: 创建 `packages/api-types` 包，结构如下：

```
packages/api-types/
├── package.json
│   {
│     "name": "@starye/api-types",
│     "exports": { ".": "./src/index.ts" },
│     "types": "./src/index.ts"
│   }
├── tsconfig.json (extends root)
└── src/
    └── index.ts
        export type { AppType } from '../../apps/api/src/index'
```

**理由**:
- ✅ Dashboard 通过 `import type { AppType } from '@starye/api-types'` 引入类型
- ✅ 开发时直接读取 `apps/api` 的源码，无需编译
- ✅ 不影响 `apps/api` 的 wrangler 构建流程
- ✅ 符合 monorepo 的 `packages/` 共享惯例

---

### 决策 2: 架构分层 - Routes → Handlers → Services

**问题**: 如何拆分 998 行的 `movies.ts`，同时确保类型推导完整？

**决定**: 采用三层架构 + 方法链模式

```
apps/api/src/routes/movies/
├── index.ts              (路由定义，方法链)
├── handlers/             (HTTP 层，处理请求/响应)
│   ├── movies.handler.ts
│   ├── actors.handler.ts
│   ├── publishers.handler.ts
│   ├── sync.handler.ts
│   └── home.handler.ts
├── services/             (业务逻辑层)
│   ├── movie.service.ts
│   ├── actor.service.ts
│   ├── publisher.service.ts
│   ├── auth.service.ts   (提取 checkIsAdult)
│   └── query-builder.ts  (通用查询构建器)
└── __tests__/
    ├── services/
    │   ├── movie.service.test.ts
    │   └── query-builder.test.ts
    └── handlers/
        └── movies.handler.test.ts
```

**方法链示例**（关键！）：

```typescript
// ❌ 旧写法（类型推导断裂）
const movies = new Hono<AppEnv>()
movies.get('/', handler1)
movies.get('/:id', handler2)
export default movies

// ✅ 新写法（类型推导完整）
export const moviesRoutes = new Hono<AppEnv>()
  .get('/', getMovieList)
  .get('/:identifier', getMovieDetail)
  .get('/featured/hot', getHotMovies)
  // ... 继续链式调用
```

**理由**:
- ✅ 方法链确保 Hono 的类型推导完整性（参考 Hono 官方最佳实践）
- ✅ Handlers 只处理 HTTP 相关逻辑（参数解析、响应格式化），易于测试
- ✅ Services 只包含业务逻辑（数据库查询、权限校验），无 HTTP 依赖
- ✅ 职责清晰，便于维护和测试

---

### 决策 3: 通用查询构建器 - 基于 Drizzle 的 `SQL[]` 模式

**问题**: 如何减少分页、过滤逻辑的重复？

**决定**: 实现 `FilterBuilder` 类（函数式 API）

```typescript
// services/query-builder.ts
export class FilterBuilder {
  private filters: SQL[] = []

  eq<T>(column: any, value?: T): this {
    if (value !== undefined) this.filters.push(eq(column, value))
    return this
  }

  like(column: any, value?: string): this {
    if (value) this.filters.push(ilike(column, `%${value}%`))
    return this
  }

  between(column: any, min?: number, max?: number): this {
    if (min !== undefined) this.filters.push(gte(column, min))
    if (max !== undefined) this.filters.push(lte(column, max))
    return this
  }

  build(): SQL | undefined {
    return this.filters.length > 0 ? and(...this.filters) : undefined
  }
}

// 使用示例
const where = new FilterBuilder()
  .eq(moviesTable.isAdult, !isAdult ? false : undefined)
  .eq(moviesTable.publisherId, publisherId)
  .like(moviesTable.name, searchKeyword)
  .build()

const query = db.select().from(moviesTable)
if (where) query = query.where(where)
```

**理由**:
- ✅ 基于 Drizzle 官方推荐的 `SQL[]` 模式（参考 `docs/drizzle/llms-full.txt` L8578-8588）
- ✅ 链式 API 符合函数式编程风格
- ✅ 可选参数自动忽略（`value === undefined` 时不添加条件）
- ✅ 易于单元测试（不依赖数据库，可 mock SQL 对象）

---

### 决策 4: 测试策略 - Vitest + 分层测试

**问题**: 如何在 Cloudflare Workers 环境测试代码？

**决定**: 

| 层级 | 覆盖率目标 | 测试方式 |
|------|-----------|---------|
| Services | 80%+ | 单元测试（mock Drizzle DB） |
| Handlers | 60%+ | 单元测试（mock Hono Context） |
| Routes | 40%+ | E2E 测试（使用 `wrangler dev --local`） |

**测试工具函数**:

```typescript
// test/helpers.ts
export function createMockDb() {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    get: vi.fn(),
  }
}

export function createMockContext(overrides = {}) {
  return {
    get: vi.fn((key) => overrides[key]),
    req: {
      query: vi.fn(() => ({})),
      param: vi.fn(),
    },
    json: vi.fn(),
  }
}
```

**理由**:
- ✅ Vitest 原生支持 TypeScript 和 ESM
- ✅ 分层测试策略平衡了覆盖率与维护成本
- ✅ Services 层无外部依赖，测试最简单（优先覆盖）
- ✅ Handlers 层 mock Context，避免启动完整 Worker 环境

---

### 决策 5: 渐进式迁移 - Movies First

**问题**: 如何降低重构风险？

**决定**: 

```
Phase 1: 基础设施（1 天）
├── 创建 packages/api-types
├── 配置 Vitest
└── 创建测试工具函数

Phase 2: Movies 模块重构（3-4 天）
├── 提取 Services 层 + 测试
├── 创建 Handlers 层 + 测试
├── 改造为方法链
└── 验证 Dashboard RPC 功能

Phase 3: 验证 & 推广（按需）
├── Dashboard 集成测试
└── 复制模式到其他模块（actors/comics/admin...）
```

**理由**:
- ✅ Movies 是最复杂的模块（998 行），验证价值最高
- ✅ 其他模块（actors/comics）可直接复用 Services/Handlers 模式
- ✅ 每个 Phase 独立可测，可随时回滚

---

## Risks / Trade-offs

### 风险 1: 方法链过长导致可读性下降

**风险**: `moviesRoutes` 有 10 个路由，方法链可能超过 50 行

**缓解措施**: 
- 按功能分组，使用注释分隔（如 `// --- 电影 CRUD ---`）
- 考虑拆分为子路由（如 `/actors` 和 `/publishers` 独立为子 App）

---

### 风险 2: `packages/api-types` 的类型同步

**风险**: 如果 `apps/api` 修改 `AppType` 但忘记更新 `api-types`，Dashboard 会出现类型不匹配

**缓解措施**:
- `api-types` 直接 re-export `apps/api` 的类型（无需手动同步）
- 在 CI 中添加 `pnpm type-check` 检查 Dashboard 的类型错误

---

### 风险 3: 测试覆盖率不足

**风险**: Services 层测试 mock 不完整，可能遗漏边界情况

**缓解措施**:
- 优先测试核心逻辑（分页、权限校验、过滤条件）
- 使用 Vitest 的 `coverage` 插件监控覆盖率
- E2E 测试补充关键路径（如同步接口）

---

### 权衡: 不使用 Project References

**权衡**: 放弃 IDE 的"跳转到定义"直接跳转到 `apps/api` 源码的能力

**理由**: 
- Cloudflare Workers 的构建流程与 TypeScript 编译输出冲突
- `packages/api-types` 的间接引用仍可跳转，体验差异不大
- 避免复杂的构建配置，降低维护成本

---

## Migration Plan

### 部署步骤

1. **创建基础设施**（不影响现有功能）
   - 创建 `packages/api-types`
   - 配置 Vitest（`apps/api/vitest.config.ts`）
   
2. **重构 Movies 模块**（保持 API 兼容）
   - 新建 `routes/movies/` 目录
   - 逐步迁移 Handlers 和 Services
   - 更新 `index.ts` 的导入路径
   
3. **验证 Dashboard 集成**
   - Dashboard 安装 `@starye/api-types`
   - 测试 `hc<AppType>()` 的类型推导
   
4. **推广到其他模块**（可选，按需执行）

### 回滚策略

- **Phase 1 失败**: 删除 `packages/api-types` 和 Vitest 配置，无影响
- **Phase 2 失败**: 回退到旧的 `movies.ts`，保留导入路径兼容性
- **Phase 3 失败**: Dashboard 回退到手动类型定义（临时方案）

### 验证检查点

- ✅ `pnpm type-check` 在 `apps/api` 和 `apps/dashboard` 均通过
- ✅ Vitest 测试覆盖率 ≥ 60%
- ✅ Dashboard 使用 `hc<AppType>()` 调用 `/movies` 接口成功
- ✅ 本地 `wrangler dev` 启动正常，接口响应与旧版一致

---

## Open Questions

1. **是否需要拆分 `/actors` 和 `/publishers` 为独立子路由？**  
   当前它们在 `movies.ts` 中（如 `/movies/actors/list`），是否应该独立为 `/actors` 路径？
   
   → 建议暂不修改路径（保持兼容性），内部拆分为独立 Handlers 即可。

2. **是否需要为其他模块（`actors.ts`、`comics.ts`）创建类似的目录结构？**  
   
   → Phase 2 先验证 Movies，成功后再按需推广。

3. **测试环境是否需要 Cloudflare Workers 模拟器？**  
   
   → Vitest 单元测试不需要，E2E 测试可使用 `wrangler dev --local`（已有 D1 本地环境）。
