# Dashboard 用户反馈系统 - 技术设计

## Context

### 当前状态
Dashboard 管理端已有完善的功能模块（电影/漫画/演员/厂商管理），但用户反馈机制不统一：
- 成功/失败提示：部分使用 `alert()`，部分只输出到 `console`
- 加载状态：只有简单的"加载中..."文字，无骨架屏
- 错误处理：直接 `console.error()`，用户看不到错误信息

Movie-app 前台已实现了 `useToast` composable，可以作为参考。

### 技术栈
- Vue 3 + TypeScript + Composition API
- Tailwind CSS（已配置）
- vue-i18n（已集成国际化）
- 无 UI 组件库依赖（自定义组件）

### 约束
- 不引入新的外部依赖
- 保持与现有 Tailwind 主题一致
- 符合 @antfu/eslint-config 规范
- 支持国际化（中/英）

## Goals / Non-Goals

**Goals:**
- 实现统一的 Toast 通知系统，替换所有 `alert()` 和 console 提示
- 提供骨架屏组件库，覆盖主要加载场景（表格/卡片/表单）
- 建立标准化的错误处理流程，提供友好的错误展示
- 改进批量操作的反馈（进度 + 结果汇总）
- 所有组件支持响应式设计和无障碍访问

**Non-Goals:**
- 不实现复杂的动画库（保持简洁）
- 不重构现有组件的内部逻辑（只改反馈层）
- 不涉及后端 API 修改
- 不实现离线错误队列（保持简单）

## Decisions

### Decision 1: 复用 movie-app 的 Toast 实现

**选择**：将 `movie-app/src/composables/useToast.ts` 复制到 dashboard，并调整样式

**理由**：
- ✅ movie-app 的实现已验证，功能完整
- ✅ 减少重复开发，保持代码一致性
- ✅ 支持队列管理、自动消失、手动关闭

**替代方案**：
- ❌ 使用第三方库（如 vue-toastification）：增加依赖，bundle size 增大
- ❌ 从零实现：重复造轮子，增加开发时间

**调整点**：
```typescript
// movie-app 使用 Shadcn UI 风格
// dashboard 需调整为与现有 Tailwind 配置一致

// 颜色映射
success: 'bg-green-500' → 'bg-green-600'
error: 'bg-red-500' → 'bg-red-600'
```

### Decision 2: 使用 Vue Teleport 渲染 Toast

**选择**：Toast 组件使用 `<Teleport to="body">` 渲染到 body 最外层

**理由**：
- ✅ 避免 z-index 冲突（不受父容器限制）
- ✅ 支持全局定位（固定在屏幕右上角）
- ✅ Vue 3 内置 API，无需依赖

**实现**：
```vue
<!-- ToastContainer.vue -->
<template>
  <Teleport to="body">
    <div class="fixed top-4 right-4 z-50 space-y-2">
      <Toast v-for="toast in toasts" :key="toast.id" :toast="toast" />
    </div>
  </Teleport>
</template>
```

### Decision 3: 骨架屏使用 CSS 动画而非 JavaScript

**选择**：骨架屏的闪烁效果使用 CSS `@keyframes` 实现

**理由**：
- ✅ 性能更好（GPU 加速）
- ✅ 代码更简洁
- ✅ 自动支持 `prefers-reduced-motion`

**实现**：
```css
@keyframes shimmer {
  0% { background-position: -1000px 0; }
  100% { background-position: 1000px 0; }
}

.skeleton {
  background: linear-gradient(90deg, #f0f0f0 25%, #f8f8f8 50%, #f0f0f0 75%);
  background-size: 1000px 100%;
  animation: shimmer 1.5s infinite;
}

@media (prefers-reduced-motion: reduce) {
  .skeleton {
    animation: pulse 2s infinite;
  }
}
```

### Decision 4: 错误处理使用分层策略

**选择**：错误处理分为三层：捕获 → 转换 → 展示

```
┌─────────────────────────────────────────┐
│          错误处理流程                    │
├─────────────────────────────────────────┤
│                                         │
│  Layer 1: 捕获 (Capture)                │
│  ├─ Vue errorHandler (组件错误)         │
│  ├─ window.onunhandledrejection (Promise)│
│  └─ try/catch in API calls              │
│                                         │
│            ↓                            │
│                                         │
│  Layer 2: 转换 (Transform)              │
│  ├─ parseError(): 识别错误类型          │
│  ├─ getErrorMessage(): 生成友好消息     │
│  └─ getErrorAction(): 确定操作建议      │
│                                         │
│            ↓                            │
│                                         │
│  Layer 3: 展示 (Display)                │
│  ├─ showToast() - 一般错误              │
│  ├─ ErrorDisplay - 页面级错误           │
│  └─ ErrorBoundary - 严重错误            │
│                                         │
└─────────────────────────────────────────┘
```

**理由**：
- ✅ 关注点分离，易于测试
- ✅ 统一的错误消息映射
- ✅ 灵活的展示策略

### Decision 5: 批量操作使用 Progress Toast

**选择**：批量操作时显示特殊的 Progress Toast，实时更新进度

**理由**：
- ✅ 用户可以看到实时进度
- ✅ 不阻塞 UI（非模态）
- ✅ 复用 Toast 机制

**实现**：
```typescript
// useToast.ts 扩展
interface ProgressToast extends Toast {
  type: 'progress'
  progress: {
    current: number
    total: number
    message: string
  }
}

// 使用
const toastId = showProgress('正在删除电影...', 0, 100)
// ... 批量操作中 ...
updateProgress(toastId, current, total, `正在删除: ${movie.title}`)
// 完成后
hideProgress(toastId, '删除完成：成功 80，失败 20')
```

### Decision 6: 不实现全局 Loading Overlay

**选择**：使用骨架屏 + 局部 loading，不实现全局遮罩层

**理由**：
- ✅ 骨架屏用户体验更好（内容占位，减少焦虑）
- ✅ 不阻塞用户操作其他区域
- ❌ 全局 Loading 会锁定整个页面，体验较差

**例外**：批量删除等危险操作，可使用模态对话框 + 进度条

## Component Architecture

### 组件关系图

```
┌─────────────────────────────────────────────────────────────┐
│                    DefaultLayout.vue                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              <RouterView />                         │   │
│  │                                                     │   │
│  │  ┌──────────────────────────────────────────────┐  │   │
│  │  │           Movies.vue / Actors.vue           │  │   │
│  │  │                                             │  │   │
│  │  │  <SkeletonTable v-if="loading" />           │  │   │
│  │  │  <DataTable v-else :data="movies" />        │  │   │
│  │  │                                             │  │   │
│  │  │  <ErrorDisplay v-if="error" />              │  │   │
│  │  │                                             │  │   │
│  │  └──────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  <!-- Teleport 到 body -->                                  │
│  <ToastContainer>                                           │
│    <Toast v-for="toast in toasts" :key="toast.id" />       │
│  </ToastContainer>                                          │
└─────────────────────────────────────────────────────────────┘
```

### 文件结构

```
apps/dashboard/src/
├── components/
│   ├── Toast.vue                  # 单个 Toast 组件
│   ├── ToastContainer.vue         # Toast 容器（Teleport）
│   ├── SkeletonTable.vue          # 表格骨架屏
│   ├── SkeletonCard.vue           # 卡片骨架屏
│   ├── SkeletonForm.vue           # 表单骨架屏
│   ├── ErrorDisplay.vue           # 错误展示组件
│   └── ProgressBar.vue            # 进度条组件（批量操作用）
│
├── composables/
│   ├── useToast.ts                # Toast 管理
│   └── useErrorHandler.ts         # 错误处理
│
└── views/
    ├── Movies.vue                 # ✏️ 集成 Toast + Skeleton
    ├── Actors.vue                 # ✏️ 集成 Toast + Skeleton
    ├── Publishers.vue             # ✏️ 集成 Toast + Skeleton
    └── ... 其他页面（按需迁移）
```

## API Design

### useToast Composable

```typescript
interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info' | 'progress'
  message: string
  duration?: number  // 0 表示不自动关闭
  progress?: {
    current: number
    total: number
    message: string
  }
}

interface ToastOptions {
  duration?: number
  closable?: boolean
}

function useToast() {
  return {
    // 基础 API
    showToast: (message: string, type: Toast['type'], options?: ToastOptions) => string,
    hideToast: (id: string) => void,
    clearAll: () => void,
    
    // 快捷方法
    success: (message: string, options?: ToastOptions) => string,
    error: (message: string, options?: ToastOptions) => string,
    warning: (message: string, options?: ToastOptions) => string,
    info: (message: string, options?: ToastOptions) => string,
    
    // 进度 Toast（批量操作专用）
    showProgress: (message: string, current: number, total: number) => string,
    updateProgress: (id: string, current: number, total: number, message?: string) => void,
    hideProgress: (id: string, finalMessage?: string) => void,
    
    // 状态
    toasts: Ref<Toast[]>,
  }
}
```

### useErrorHandler Composable

```typescript
interface ErrorHandlerOptions {
  message?: string      // 自定义错误消息
  silent?: boolean      // 不显示 Toast
  onRetry?: () => void  // 重试回调
  showIn?: 'toast' | 'banner' | 'modal'  // 展示方式
}

interface ParsedError {
  type: 'network' | 'permission' | 'validation' | 'server' | 'unknown'
  message: string
  code?: number
  details?: any
}

function useErrorHandler() {
  return {
    // 主要 API
    handleError: (error: unknown, options?: ErrorHandlerOptions) => void,
    
    // 工具方法
    parseError: (error: unknown) => ParsedError,
    getErrorMessage: (error: ParsedError) => string,
    getErrorAction: (error: ParsedError) => { label: string, action: () => void } | null,
    
    // 状态
    lastError: Ref<ParsedError | null>,
  }
}
```

## Implementation Strategy

### Phase 1: 核心组件（第 1 周）

#### 任务 1.1: Toast 系统
1. 创建 `useToast.ts`（参考 movie-app）
2. 创建 `Toast.vue` 和 `ToastContainer.vue`
3. 在 `DefaultLayout.vue` 中集成
4. 在 `Movies.vue` 中试点应用（替换 alert）

#### 任务 1.2: 骨架屏组件
1. 创建 `SkeletonTable.vue`（配置列数/行数）
2. 创建 `SkeletonCard.vue`（支持 stat/content/image 变体）
3. 创建 `SkeletonForm.vue`（配置字段数）
4. 在 `Movies.vue` 和 `Home.vue` 试点应用

#### 任务 1.3: 错误处理
1. 创建 `useErrorHandler.ts`
2. 创建 `ErrorDisplay.vue`
3. 集成全局错误捕获（Vue errorHandler）
4. 在 `Movies.vue` 试点应用

### Phase 2: 全面迁移（第 2 周）

#### 任务 2.1: 迁移所有页面
- Movies.vue ✅（试点）
- Actors.vue
- Publishers.vue
- Crawlers.vue
- Comics.vue
- Users.vue
- AuditLogs.vue
- 其他页面

#### 任务 2.2: 批量操作增强
- 实现 Progress Toast
- 在批量删除/更新中集成
- 添加成功/失败统计展示

### Phase 3: 测试和优化（第 3 周）

#### 任务 3.1: 单元测试
- Toast 组件测试
- useToast composable 测试
- useErrorHandler composable 测试

#### 任务 3.2: 国际化
- 提取错误消息到 i18n
- 添加英文翻译

#### 任务 3.3: 无障碍性
- 添加 ARIA 属性
- 键盘导航支持
- 屏幕阅读器测试

## Risks / Trade-offs

### Risk 1: Toast 队列过多影响 UX
**风险**：批量操作可能产生大量 Toast，堆满屏幕  
**缓解**：
- 限制最多同时显示 5 个 Toast
- 批量操作使用单个 Progress Toast 而非多个 Toast
- 提供"清除所有"按钮

### Risk 2: 骨架屏与实际内容不匹配
**风险**：骨架屏布局与真实数据差异大，导致布局跳动  
**缓解**：
- 骨架屏高度与实际组件保持一致
- 使用真实页面的 CSS class 确保一致性
- 开发时对比骨架屏和真实内容，调整占位尺寸

### Risk 3: 错误消息映射不完整
**风险**：某些错误没有友好的映射，显示原始错误信息  
**缓解**：
- 提供默认的通用错误消息："操作失败，请稍后重试"
- 逐步完善错误消息映射表
- 在开发时记录遇到的新错误类型

### Trade-off: 简单实现 vs 完整功能

**取舍**：优先实现核心功能，高级功能后续迭代

**第一版包含**：
- ✅ Toast 基础类型（success/error/warning/info）
- ✅ 自动消失和手动关闭
- ✅ 基础骨架屏（Table/Card）
- ✅ 基础错误映射（网络/权限/服务器）

**后续迭代**：
- ⏭️ Toast 操作按钮（Toast 内嵌"重试"按钮）
- ⏭️ Toast 分组（相同类型的合并显示）
- ⏭️ 骨架屏变体（更多样式）
- ⏭️ 错误上报到监控服务

## Migration Plan

### 部署步骤

1. **开发和测试**
   - 在本地开发环境实现所有组件
   - 在 Movies.vue 试点集成
   - 单元测试通过

2. **灰度发布**
   - 合并到 main 分支
   - Cloudflare Pages 自动部署到生产环境
   - 由于是 UI 改进，无需数据库迁移

3. **监控和反馈**
   - 监控前端错误日志（是否有新错误）
   - 收集用户反馈
   - 根据反馈调整错误消息和 Toast 行为

### 回滚策略

- **风险**：Toast/骨架屏导致页面崩溃
- **回滚**：Git revert 相关提交，重新部署
- **影响**：仅 UI 改进，回滚无数据风险

### 兼容性

- **向后兼容**：不破坏现有功能
- **浏览器兼容**：支持所有现代浏览器（Chrome/Firefox/Safari/Edge）
- **移动端**：响应式设计，移动端和桌面端都可用

## Technical Details

### Toast 状态管理

使用 Vue 3 的响应式系统管理 Toast 队列：

```typescript
// useToast.ts
const toasts = ref<Toast[]>([])

function showToast(message: string, type: Toast['type'], options?: ToastOptions): string {
  const id = crypto.randomUUID()
  const duration = options?.duration ?? (type === 'error' ? 5000 : 3000)
  
  toasts.value.push({ id, type, message, duration })
  
  if (duration > 0) {
    setTimeout(() => hideToast(id), duration)
  }
  
  return id
}

function hideToast(id: string) {
  const index = toasts.value.findIndex(t => t.id === id)
  if (index !== -1) {
    toasts.value.splice(index, 1)
  }
}
```

### 错误类型识别

```typescript
// useErrorHandler.ts
function parseError(error: unknown): ParsedError {
  // Fetch 错误
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return { type: 'network', message: '网络连接失败' }
  }
  
  // API 错误
  if (typeof error === 'object' && error && 'status' in error) {
    const status = (error as any).status
    
    if (status === 403) {
      return { type: 'permission', message: '权限不足', code: 403 }
    }
    
    if (status === 404) {
      return { type: 'validation', message: '资源不存在', code: 404 }
    }
    
    if (status >= 500) {
      return { type: 'server', message: '服务器错误', code: status }
    }
  }
  
  // 默认错误
  return { type: 'unknown', message: '操作失败，请重试' }
}
```

### 骨架屏颜色变量

使用 Tailwind CSS 变量确保主题一致性：

```css
/* skeleton.css */
.skeleton-base {
  background: linear-gradient(
    90deg,
    hsl(var(--muted)) 25%,
    hsl(var(--muted-foreground) / 0.1) 50%,
    hsl(var(--muted)) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
```

## Open Questions

### Q1: 是否需要 Toast 音效？
**现状**：无音效  
**考虑**：成功/错误时播放简短音效  
**决策**：暂不实现，避免干扰用户（大多数管理端不需要音效）

### Q2: 错误上报到哪里？
**现状**：只记录到 console  
**考虑**：发送到 Cloudflare Workers 的 /api/monitoring/errors  
**决策**：第一版只记录 console，后续集成已有的 monitoring API

### Q3: 是否支持 Toast 操作按钮？
**现状**：Toast 只显示消息  
**考虑**：在 Toast 内添加"重试"、"撤销"等按钮  
**决策**：第一版不实现，复杂操作使用模态对话框

### Q4: 骨架屏是否需要随机高度？
**现状**：固定高度的占位块  
**考虑**：随机高度的占位块，更接近真实内容  
**决策**：不实现，随机高度会导致布局跳动更严重
