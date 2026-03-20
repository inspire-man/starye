# 任务 11 实施报告：Dashboard 电影编辑页选择器

## 实施概览

成功实现了 Dashboard 电影编辑页的女优和厂商选择器，使管理员可以在编辑电影时方便地管理女优和厂商关联关系。

## 核心功能

### 1. 女优选择器 (ActorSelector.vue)

**功能特性：**
- 搜索功能：模糊匹配女优名称，实时显示搜索结果
- 多选功能：支持勾选/取消勾选多个女优
- 拖拽排序：已选择的女优可通过拖拽调整显示顺序 (sortOrder)
- 快速创建：搜索无结果时，一键创建新女优并自动添加到选择列表
- 实时显示：显示每个女优的作品数量 (movieCount)

**技术实现：**
```typescript
// 组件路径
apps/dashboard/src/components/ActorSelector.vue

// 主要状态
selectedActors: { id: string, name: string, sortOrder: number }[]

// 拖拽排序使用 HTML5 Drag & Drop API
handleDragStart(index: number)
handleDragOver(e: DragEvent, index: number)
handleDragEnd()
```

### 2. 厂商选择器 (PublisherSelector.vue)

**功能特性：**
与女优选择器功能相同：
- 搜索、多选、拖拽排序
- 快速创建新厂商
- 显示厂商作品数量

**技术实现：**
```typescript
// 组件路径
apps/dashboard/src/components/PublisherSelector.vue

// 主要状态
selectedPublishers: { id: string, name: string, sortOrder: number }[]
```

### 3. 电影编辑表单集成

**修改文件：**
- `apps/dashboard/src/views/Movies.vue`

**集成方式：**
1. 在编辑表单的"元数据"标签页中添加两个选择器
2. 位置：在"厂商"字段下方，"R18 内容"复选框上方
3. 打开编辑弹窗时，自动加载电影的现有女优和厂商关联
4. 保存时，同步更新 `movie_actors` 和 `movie_publishers` 关联表

```vue
<!-- 在表单中的位置 -->
<div class="form-row">
  <label>厂商</label>
  <input v-model="editingMovie.publisher" type="text">
</div>

<div class="form-row">
  <ActorSelector v-model="selectedActors" />
</div>

<div class="form-row">
  <PublisherSelector v-model="selectedPublishers" />
</div>
```

## 后端 API 支持

### 1. 创建女优端点

**端点：** `POST /api/admin/actors`

**功能：**
- 创建新女优记录
- 自动生成 slug 和 sourceId
- 标记 source 为 'manual'

**实现文件：**
- `apps/api/src/routes/admin-actors.ts`

### 2. 创建厂商端点

**端点：** `POST /api/admin/publishers`

**功能：**
- 创建新厂商记录
- 自动生成 slug 和 sourceId
- 标记 source 为 'manual'

**实现文件：**
- `apps/api/src/routes/admin-publishers.ts`

### 3. 更新电影女优关联端点

**端点：** `PUT /api/admin/movies/:id/actors`

**请求体：**
```json
{
  "actors": [
    { "id": "uuid", "sortOrder": 0 },
    { "id": "uuid", "sortOrder": 1 }
  ]
}
```

**功能：**
- 删除电影的现有女优关联
- 创建新的关联记录，包含 sortOrder

**实现文件：**
- `apps/api/src/routes/admin-movies.ts`

### 4. 更新电影厂商关联端点

**端点：** `PUT /api/admin/movies/:id/publishers`

**请求体：**
```json
{
  "publishers": [
    { "id": "uuid", "sortOrder": 0 }
  ]
}
```

**功能：**
- 删除电影的现有厂商关联
- 创建新的关联记录，包含 sortOrder

**实现文件：**
- `apps/api/src/routes/admin-movies.ts`

## 前端 API 客户端更新

**文件：** `apps/dashboard/src/lib/api.ts`

**新增方法：**
```typescript
// 创建女优
createActor: (data: { name: string }) => 
  fetchApi<{ id: string, name: string }>('/admin/actors', { 
    method: 'POST', 
    body: JSON.stringify(data) 
  })

// 创建厂商
createPublisher: (data: { name: string }) => 
  fetchApi<{ id: string, name: string }>('/admin/publishers', { 
    method: 'POST', 
    body: JSON.stringify(data) 
  })

// 更新电影女优关联
updateMovieActors: (movieId: string, actors: { id: string, name: string, sortOrder: number }[]) =>
  fetchApi(`/admin/movies/${movieId}/actors`, {
    method: 'PUT',
    body: JSON.stringify({ actors }),
  })

// 更新电影厂商关联
updateMoviePublishers: (movieId: string, publishers: { id: string, name: string, sortOrder: number }[]) =>
  fetchApi(`/admin/movies/${movieId}/publishers`, {
    method: 'PUT',
    body: JSON.stringify({ publishers }),
  })
```

## 类型定义更新

**文件：** `apps/dashboard/src/lib/api.ts`

**Movie 接口更新：**
```typescript
export interface Movie {
  // ... 其他字段
  actors?: (string | { id: string, name: string })[] | null
  publishers?: (string | { id: string, name: string })[] | null
  // ... 其他字段
}
```

**说明：**
- 支持字符串数组（兼容旧数据）
- 支持对象数组（新的关联数据）

## 用户体验

### 1. 搜索女优/厂商
1. 在选择器中输入名称
2. 实时显示匹配结果，包含作品数量
3. 点击或勾选复选框添加到选择列表

### 2. 快速创建
1. 搜索不存在的女优/厂商
2. 点击"+ 创建"按钮
3. 弹出创建表单，自动填充搜索内容
4. 确认创建后自动添加到选择列表

### 3. 拖拽排序
1. 在已选择列表中，拖动左侧的"☰"图标
2. 移动到目标位置释放
3. 自动重新计算 sortOrder（从 0 开始递增）
4. 右侧显示当前排序位置（#1, #2, ...）

### 4. 删除关联
- 点击已选择项右侧的"×"按钮
- 立即从列表移除，自动调整其他项的 sortOrder

## 数据流程

### 打开编辑弹窗
```
Movies.vue
  ↓ openEditModal(movie)
  ↓ 加载 movie.actors 和 movie.publishers
  ↓ 转换为 { id, name, sortOrder }[] 格式
  ↓ 设置 selectedActors 和 selectedPublishers
  ↓ 传递给 ActorSelector 和 PublisherSelector
```

### 保存更新
```
Movies.vue
  ↓ handleUpdate()
  ↓ 调用 api.admin.updateMovie() 更新基本信息
  ↓ 调用 api.admin.updateMovieActors() 更新女优关联
  ↓ 调用 api.admin.updateMoviePublishers() 更新厂商关联
  ↓ 关闭弹窗
  ↓ 重新加载电影列表
```

## 代码质量

### 类型检查
✅ 通过 `pnpm type-check`
- 所有 TypeScript 类型正确
- 无类型错误

### Lint 检查
✅ 通过 `pnpm lint:fix`
- 所有 ESLint 规则通过
- 代码格式规范

## UI 设计

### 选择器样式
- 边框：灰色圆角边框
- 背景：浅灰色 (#f9fafb)
- 搜索框：白色背景，带边框
- 搜索结果：白色卡片，悬停效果
- 已选择项：白色卡片，蓝色边框高亮

### 拖拽视觉反馈
- 拖拽手柄：灰色"☰"图标
- 悬停状态：蓝色边框
- 拖拽中：光标变为 grabbing

### 创建表单
- 模态弹窗：半透明黑色遮罩
- 表单卡片：白色，圆角，阴影
- 按钮：主按钮蓝色，次要按钮灰色

## 已完成的任务

- [x] 11.1 创建 ActorSelector.vue 女优选择器组件
- [x] 11.2 实现女优搜索（模糊匹配 name）
- [x] 11.3 实现多选功能（勾选多个女优）
- [x] 11.4 实现拖拽排序（调整 sortOrder）
- [x] 11.5 实现快速创建功能（女优不存在时弹出创建表单）
- [x] 11.6 创建 PublisherSelector.vue 厂商选择器组件
- [x] 11.7 实现厂商搜索、多选、快速创建
- [x] 11.8 修改 Movies.vue 电影编辑表单，集成女优和厂商选择器
- [x] 11.9 保存电影时，同步更新 movie_actors 和 movie_publishers 关联记录

## 下一步

建议进行以下测试（任务 13.10）：
1. 测试女优选择器：搜索、多选、排序、快速创建
2. 测试厂商选择器：搜索、多选、快速创建
3. 测试保存功能：验证关联记录正确创建
4. 测试数据加载：验证打开编辑弹窗时正确显示现有关联
5. 测试拖拽排序：验证 sortOrder 正确计算
6. 测试删除关联：验证删除后 sortOrder 重新计算
7. 测试快速创建：验证新创建的女优/厂商自动添加到选择列表

## 技术亮点

1. **组件复用**：女优和厂商选择器使用几乎相同的代码结构，便于维护
2. **拖拽排序**：使用原生 HTML5 Drag & Drop API，无需额外依赖
3. **类型安全**：完整的 TypeScript 类型定义，编译时捕获错误
4. **用户体验**：实时搜索、快速创建、拖拽排序，操作流畅
5. **数据一致性**：通过 API 端点统一管理关联关系，保证数据完整性
