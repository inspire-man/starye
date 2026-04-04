## ADDED Requirements

### Requirement: 通用组件提取到 @starye/ui
以下 Dashboard 组件 MUST 被提取到 `@starye/ui` 包，样式从 `<style scoped>` 硬编码 CSS 重写为 Tailwind class，使用 shadcn/ui 语义化 token（如 `bg-background`、`text-foreground`、`border-border`）SHALL。

提取清单：Pagination、DataTable、ConfirmDialog、FilterPanel、Toast、ToastContainer、ErrorDisplay、SkeletonCard、SkeletonTable。

#### Scenario: Pagination 组件跨 app 使用
- **WHEN** Movie App 中 `import { Pagination } from '@starye/ui'` 并传入 currentPage、totalPages、total props
- **THEN** 渲染出与 Dashboard 相同功能的分页组件，颜色跟随该 app 的品牌色（通过 CSS 变量）

#### Scenario: DataTable 泛型保持
- **WHEN** 提取 DataTable 到 @starye/ui
- **THEN** 泛型 `<T extends { id: string }>` 保持不变，columns 定义方式不变，仅样式实现从硬编码 CSS 变为 Tailwind class

#### Scenario: Toast 实现统一
- **WHEN** 合并 Dashboard 和 Movie App 的两套 Toast 实现到 @starye/ui
- **THEN** 导出统一的 `useToast` composable，API 覆盖 success/error/warning/info 四种类型

### Requirement: 配套 composable 提取
useToast、usePagination、useFilters MUST 作为 composable 从 Dashboard 提取到 `@starye/ui`，导出路径为 `@starye/ui` SHALL。

#### Scenario: useToast 跨 app 一致性
- **WHEN** Blog、Dashboard、Movie App 分别使用 `import { useToast } from '@starye/ui'`
- **THEN** 三个 app 的 Toast 行为一致：自动消失、支持手动关闭、支持进度条模式

### Requirement: Dashboard 组件引用路径迁移
Dashboard 中使用已提取组件的文件 MUST 将导入路径从 `@/components/X` 更新为 `@starye/ui` SHALL。Dashboard 本地的组件文件在确认不再被引用后 MUST 删除。

#### Scenario: Dashboard 迁移后功能不变
- **WHEN** Dashboard 的 Movies.vue 将 `import Pagination from '@/components/Pagination.vue'` 改为 `import { Pagination } from '@starye/ui'`
- **THEN** 页面分页功能行为完全不变
