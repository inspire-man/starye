# 任务 9.3-9.4 实施报告：Dashboard 批量操作功能

## 实施概述

**完成时间：** 2026-03-20  
**任务范围：** Dashboard 女优管理页面批量操作功能  
**实施状态：** ✅ 已完成

---

## 实施内容

### 任务 9.3：添加"重新爬取"批量操作按钮

#### 前端实现（`apps/dashboard/src/views/Actors.vue`）

**1. 新增状态管理**
```typescript
// 批量操作相关
const selectedActors = ref<Set<string>>(new Set())
const isBatchOperating = ref(false)
```

**2. 批量选择功能**
- 添加 `toggleActorSelection(actorId)` - 单个演员选择/取消
- 添加 `toggleSelectAll()` - 全选/取消全选当前页
- 添加 `hasSelection` 计算属性 - 判断是否有选中项

**3. UI 组件更新**

**DataTable 添加选择列：**
```vue
<template #cell-select="{ item }">
  <input
    type="checkbox"
    :checked="selectedActors.has(item.id)"
    @click.stop="toggleActorSelection(item.id)"
  >
</template>
```

**批量操作工具栏：**
```vue
<div v-if="hasSelection" class="batch-actions">
  <span class="batch-info">已选择 {{ selectedActors.size }} 个演员</span>
  <button @click="handleBatchRecrawl">重新爬取详情</button>
  <button @click="toggleSelectAll">全选当前页</button>
  <button @click="selectedActors.clear()">取消选择</button>
</div>
```

**4. 样式优化**
- 批量操作栏采用浅灰背景，与主内容区分
- 按钮禁用状态（操作进行中）
- 响应式布局

---

### 任务 9.4：实现批量补全详情功能

#### 后端 API 实现（`apps/api/src/routes/admin-actors.ts`）

**新增端点：`POST /api/admin/actors/batch-recrawl`**

```typescript
adminActors.post(
  '/batch-recrawl',
  zValidator('json', z.object({
    ids: z.array(z.string()).min(1).max(100),
  })),
  async (c) => {
    // 实现逻辑
  },
)
```

**功能说明：**
1. 接收演员 ID 数组（最多 100 个）
2. 对每个演员执行以下操作：
   - 将 `hasDetailsCrawled` 设为 `false`
   - 将 `crawlFailureCount` 重置为 `0`
   - 更新 `lastCrawlAttempt` 为当前时间
3. 记录审计日志（每个演员一条）
4. 返回操作结果统计

**返回格式：**
```json
{
  "success": true,
  "total": 10,
  "marked": 10,
  "message": "已标记 10 个演员为待重新爬取"
}
```

#### 前端 API 客户端（`apps/dashboard/src/lib/api.ts`）

**新增方法：**
```typescript
batchRecrawlActors: (ids: string[]) =>
  fetchApi<{ 
    success: boolean
    total: number
    marked: number
    message: string 
  }>('/admin/actors/batch-recrawl', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  })
```

#### 批量操作流程

**1. 用户交互：**
1. 用户在列表中勾选需要重新爬取的演员
2. 点击"重新爬取详情"按钮
3. 弹出确认对话框：`确定要标记 N 个演员为"待重新爬取"吗？`
4. 确认后，前端发起批量 API 请求

**2. 后端处理：**
1. 验证权限（需要 movie_admin 或 admin 角色）
2. 校验 ID 列表（最多 100 个）
3. 逐个更新演员状态
4. 记录审计日志
5. 返回操作结果

**3. 结果反馈：**
- 成功：清空选择，刷新列表
- 失败：显示错误提示

---

## 技术实现细节

### 数据流

```
用户勾选演员
    ↓
前端：selectedActors.add(id)
    ↓
用户点击"重新爬取"
    ↓
前端：api.admin.batchRecrawlActors(ids)
    ↓
后端：POST /api/admin/actors/batch-recrawl
    ↓
更新数据库：
  - hasDetailsCrawled = false
  - crawlFailureCount = 0
  - lastCrawlAttempt = now()
    ↓
记录审计日志
    ↓
返回结果 → 前端刷新列表
```

### 爬虫集成

标记为"待重新爬取"的演员会在下次爬虫运行时被处理：

1. **爬虫启动** → 查询 `hasDetailsCrawled = false` 的演员
2. **爬取详情** → 访问女优详情页，解析信息
3. **成功** → 设置 `hasDetailsCrawled = true`
4. **失败** → `crawlFailureCount++`，保持 `hasDetailsCrawled = false`

**失败降级机制：**
- `crawlFailureCount < 3`：继续尝试
- `crawlFailureCount >= 3`：跳过（需要手动重置）

---

## 与现有功能的对比

### 厂商批量操作（任务 10.2）

任务 10.2 标记为已完成，但实际上并未实施。本次实施的女优批量操作可以作为模板，快速应用到厂商管理页面。

**复用步骤：**
1. 复制 `Actors.vue` 的批量选择逻辑到 `Publishers.vue`
2. 在 `admin-publishers.ts` 中添加 `POST /batch-recrawl` 端点
3. 在 `api.ts` 中添加 `batchRecrawlPublishers` 方法

---

## 测试验证

### 手动测试步骤

1. **启动 Dashboard：**
   ```powershell
   cd apps/dashboard
   pnpm dev
   ```

2. **登录管理后台**

3. **进入演员管理页面：**
   - 导航至 `/actors`

4. **测试批量选择：**
   - 勾选多个演员（建议选择 `hasDetailsCrawled = false` 的）
   - 验证"已选择 N 个演员"提示显示
   - 点击"全选当前页"，验证所有演员被选中
   - 点击"取消选择"，验证选择被清空

5. **测试批量重新爬取：**
   - 勾选 3-5 个演员
   - 点击"重新爬取详情"
   - 验证确认对话框显示
   - 确认后，验证：
     - 按钮变为"处理中..."（禁用状态）
     - 操作完成后，列表自动刷新
     - 选择被清空

6. **验证数据库更新：**
   ```sql
   SELECT id, name, hasDetailsCrawled, crawlFailureCount, lastCrawlAttempt
   FROM actors
   WHERE id IN ('selected-ids');
   ```
   预期结果：
   - `hasDetailsCrawled = 0 (false)`
   - `crawlFailureCount = 0`
   - `lastCrawlAttempt` 为最新时间

7. **验证审计日志：**
   ```sql
   SELECT * FROM audit_logs
   WHERE resourceType = 'actor'
   AND action = 'UPDATE'
   ORDER BY createdAt DESC
   LIMIT 10;
   ```
   预期结果：每个演员有一条 `mark_for_recrawl` 日志

---

## API 端点文档

### POST /api/admin/actors/batch-recrawl

**权限：** movie_admin 或 admin

**请求体：**
```json
{
  "ids": ["uuid1", "uuid2", "uuid3"]
}
```

**校验规则：**
- `ids` 必须是字符串数组
- 至少包含 1 个 ID
- 最多包含 100 个 ID

**响应（成功）：**
```json
{
  "success": true,
  "total": 10,
  "marked": 10,
  "message": "已标记 10 个演员为待重新爬取"
}
```

**响应（失败）：**
```json
{
  "error": "错误信息"
}
```

**状态码：**
- `200` - 成功
- `400` - 请求参数错误
- `401` - 未登录
- `403` - 权限不足
- `500` - 服务器错误

---

## 性能考虑

### 批量限制

- 单次最多处理 100 个演员
- 前端按钮禁用，防止重复提交
- 后端逐个更新（而非批量 SQL），确保审计日志准确

### 扩展性

如需处理更大量级（如 1000+ 演员）：
1. 引入 Cloudflare Queues 异步处理
2. 实现任务进度跟踪
3. 提供任务取消功能

---

## 代码质量

### 类型安全

- ✅ 所有 API 响应类型已定义
- ✅ 前端 TypeScript 类型检查通过
- ✅ 后端 Zod schema 验证

### 代码规范

- ✅ ESLint 检查通过
- ✅ 中文注释清晰
- ✅ 函数命名语义化

### 错误处理

- ✅ API 错误捕获并提示用户
- ✅ 后端记录错误日志
- ✅ 部分失败时返回成功数量

---

## 后续优化建议

### 1. 任务进度跟踪（可选）
当前为同步操作，适合小批量（< 100）。如需支持大批量：
- 引入 Cloudflare Durable Objects 存储任务状态
- 提供 `GET /api/admin/tasks/:id/status` 查询进度
- 前端轮询或 WebSocket 实时更新

### 2. 智能筛选快捷按钮（建议）
在筛选栏添加快捷按钮：
- "仅待补全详情"（`hasDetailsCrawled = false`）
- "失败 ≥ 3 次"（`crawlFailureCount >= 3`）
- 一键选择筛选结果

### 3. 批量操作历史（可选）
记录批量操作历史：
- 操作人、操作时间
- 涉及演员数量
- 操作结果

---

## 总结

✅ **任务 9.3-9.4 已完成**

**已实现功能：**
1. Dashboard 演员列表批量选择 UI
2. 批量标记为待重新爬取 API
3. 前端操作流程和反馈
4. 审计日志记录
5. 类型安全和错误处理

**适用场景：**
- 补全缺失的演员详情（avatar、bio 等）
- 重试失败的爬取任务
- 数据质量管理

**待扩展：**
- 应用到厂商管理页面（任务 10.2）
- 大批量异步处理（可选）

---

**报告生成时间：** 2026-03-20  
**实施人员：** AI Assistant
