# Dashboard 用户反馈系统 - 实施任务

> 实现统一的 Toast 通知、骨架屏加载和错误处理系统

## 1. Toast 通知系统

### 1.1 核心 Composable

- [x] 1.1.1 创建 `apps/dashboard/src/composables/useToast.ts`（参考 movie-app）
- [x] 1.1.2 定义 Toast 接口类型（Toast, ToastOptions, ProgressToast）
- [x] 1.1.3 实现 `showToast` 基础方法（创建、添加到队列、自动消失）
- [x] 1.1.4 实现 `hideToast` 方法（手动关闭）
- [x] 1.1.5 实现快捷方法（success, error, warning, info）
- [x] 1.1.6 实现 Toast 队列限制（最多 5 个）
- [x] 1.1.7 实现 Progress Toast 方法（showProgress, updateProgress, hideProgress）

### 1.2 Toast 组件

- [x] 1.2.1 创建 `apps/dashboard/src/components/Toast.vue`
- [x] 1.2.2 实现四种类型的样式（success/error/warning/info）
- [x] 1.2.3 添加关闭按钮和点击事件
- [x] 1.2.4 实现淡入淡出动画（200ms transition）
- [x] 1.2.5 添加类型图标（✓ / ✗ / ⚠️ / ℹ️）
- [x] 1.2.6 实现 Progress Toast 变体（进度条 + 百分比）
- [x] 1.2.7 响应式设计（桌面 400px，移动端全宽）

### 1.3 Toast 容器

- [x] 1.3.1 创建 `apps/dashboard/src/components/ToastContainer.vue`
- [x] 1.3.2 使用 Teleport 渲染到 body
- [x] 1.3.3 实现垂直堆叠布局（space-y-2）
- [x] 1.3.4 添加到 `DefaultLayout.vue` 中
- [x] 1.3.5 确保 z-index 高于所有其他元素（z-50）

### 1.4 无障碍性

- [x] 1.4.1 添加 ARIA 属性（role="status" 或 role="alert"）
- [x] 1.4.2 实现 Escape 键关闭当前 Toast
- [x] 1.4.3 确保屏幕阅读器可朗读 Toast 内容

## 2. 骨架屏组件

### 2.1 SkeletonTable 组件

- [x] 2.1.1 创建 `apps/dashboard/src/components/SkeletonTable.vue`
- [x] 2.1.2 实现 Props（rows, columns, widths, selectable）
- [x] 2.1.3 实现表格结构（thead + tbody）
- [x] 2.1.4 实现闪烁动画（shimmer effect）
- [x] 2.1.5 支持自定义列宽
- [x] 2.1.6 支持复选框列占位
- [x] 2.1.7 确保高度与真实表格一致

### 2.2 SkeletonCard 组件

- [x] 2.2.1 创建 `apps/dashboard/src/components/SkeletonCard.vue`
- [x] 2.2.2 实现 stat 变体（图标 + 大号数字 + 描述）
- [x] 2.2.3 实现 content 变体（标题 + 多行内容）
- [x] 2.2.4 实现 image 变体（图片占位 + 文字）
- [x] 2.2.5 添加闪烁动画
- [x] 2.2.6 响应式设计（支持 grid 布局）

### 2.3 SkeletonForm 组件

- [x] 2.3.1 创建 `apps/dashboard/src/components/SkeletonForm.vue`
- [x] 2.3.2 实现字段占位（label + input）
- [x] 2.3.3 支持 textarea 占位（3 倍高度）
- [x] 2.3.4 支持按钮占位（底部操作按钮）
- [x] 2.3.5 添加闪烁动画

### 2.4 骨架屏样式

- [x] 2.4.1 创建 `apps/dashboard/src/styles/skeleton.css`
- [x] 2.4.2 定义 shimmer 动画关键帧
- [x] 2.4.3 定义基础骨架屏 class（.skeleton-base）
- [x] 2.4.4 支持 prefers-reduced-motion（降级为 pulse 动画）
- [x] 2.4.5 确保颜色与 Tailwind 主题变量一致

## 3. 错误处理系统

### 3.1 useErrorHandler Composable

- [x] 3.1.1 创建 `apps/dashboard/src/composables/useErrorHandler.ts`
- [x] 3.1.2 定义错误类型接口（ParsedError）
- [x] 3.1.3 实现 `parseError` 方法（识别错误类型）
- [x] 3.1.4 实现错误消息映射（网络/权限/验证/服务器/未知）
- [x] 3.1.5 实现 `getErrorMessage` 方法（生成友好消息）
- [x] 3.1.6 实现 `getErrorAction` 方法（生成操作建议）
- [x] 3.1.7 实现 `handleError` 主方法（集成 Toast 显示）

### 3.2 ErrorDisplay 组件

- [x] 3.2.1 创建 `apps/dashboard/src/components/ErrorDisplay.vue`
- [x] 3.2.2 实现 inline 模式（字段下方红色文字）
- [x] 3.2.3 实现 banner 模式（页面顶部警告条）
- [x] 3.2.4 实现 modal 模式（错误对话框）
- [x] 3.2.5 添加操作按钮（重试/返回/联系支持）
- [x] 3.2.6 添加 ARIA 属性（role="alert"）

### 3.3 全局错误捕获

- [x] 3.3.1 在 `main.ts` 中设置 Vue errorHandler
- [x] 3.3.2 捕获组件错误并显示 ErrorDisplay
- [x] 3.3.3 在 `main.ts` 中设置 window.onunhandledrejection
- [x] 3.3.4 捕获 Promise rejection 并显示错误提示
- [x] 3.3.5 记录错误到控制台（包含上下文信息）

### 3.4 错误消息国际化

- [x] 3.4.1 在 `locales/zh.json` 中添加错误消息翻译
- [x] 3.4.2 在 `locales/en.json` 中添加错误消息翻译
- [x] 3.4.3 在 `useErrorHandler` 中集成 i18n
- [x] 3.4.4 确保所有错误消息都有翻译键

## 4. Movies.vue 试点集成

### 4.1 Toast 集成

- [x] 4.1.1 导入 `useToast` 到 `Movies.vue`
- [x] 4.1.2 替换所有 `alert()` 调用为 `showToast()`
- [x] 4.1.3 保存成功时显示 success Toast
- [x] 4.1.4 保存失败时显示 error Toast
- [x] 4.1.5 删除操作后显示结果 Toast

### 4.2 骨架屏集成

- [x] 4.2.1 导入 `SkeletonTable` 到 `Movies.vue`
- [x] 4.2.2 在 `loading=true` 时显示 SkeletonTable
- [x] 4.2.3 配置骨架屏列数和行数（匹配真实表格）
- [x] 4.2.4 测试骨架屏到内容的平滑过渡

### 4.3 错误处理集成

- [x] 4.3.1 导入 `useErrorHandler` 到 `Movies.vue`
- [x] 4.3.2 替换所有 try-catch 中的 `console.error()`
- [x] 4.3.3 API 错误使用 `handleError()` 处理
- [ ] 4.3.4 添加重试逻辑（网络错误时）
- [ ] 4.3.5 测试各种错误场景（403/404/500/网络）

### 4.4 批量操作增强

- [ ] 4.4.1 批量删除使用 Progress Toast
- [ ] 4.4.2 循环处理每个项目，更新进度
- [ ] 4.4.3 完成后显示汇总（成功 N，失败 M）
- [ ] 4.4.4 失败项目展示详细错误信息

## 5. Home.vue 集成

### 5.1 骨架屏集成

- [x] 5.1.1 导入 `SkeletonCard` 到 `Home.vue`
- [x] 5.1.2 在统计卡片加载时显示骨架屏
- [x] 5.1.3 使用 stat 变体（匹配统计卡片布局）
- [x] 5.1.4 配置 grid 布局（md:grid-cols-2 lg:grid-cols-4）

### 5.2 错误处理集成

- [x] 5.2.1 导入 `useErrorHandler` 到 `Home.vue`
- [x] 5.2.2 API 错误时显示 ErrorDisplay（banner 模式）
- [ ] 5.2.3 添加重试按钮（重新获取统计数据）

## 6. 其他页面迁移

### 6.1 Actors.vue

- [x] 6.1.1 集成 Toast（替换 alert）
- [x] 6.1.2 集成 SkeletonTable
- [x] 6.1.3 集成错误处理

### 6.2 Publishers.vue

- [x] 6.2.1 集成 Toast（替换 alert）
- [x] 6.2.2 集成 SkeletonTable
- [x] 6.2.3 集成错误处理

### 6.3 Crawlers.vue

- [ ] 6.3.1 集成 Toast（替换 alert）
- [ ] 6.3.2 集成 SkeletonTable
- [ ] 6.3.3 集成错误处理

### 6.4 Comics.vue

- [x] 6.4.1 集成 Toast（替换 alert）
- [x] 6.4.2 集成 SkeletonTable
- [x] 6.4.3 集成错误处理

### 6.5 ActorDetail.vue

- [ ] 6.5.1 集成 Toast（替换 alert）
- [ ] 6.5.2 集成 SkeletonForm
- [ ] 6.5.3 集成错误处理

### 6.6 PublisherDetail.vue

- [ ] 6.6.1 集成 Toast（替换 alert）
- [ ] 6.6.2 集成 SkeletonForm
- [ ] 6.6.3 集成错误处理

### 6.7 其他页面

- [ ] 6.7.1 Users.vue - Toast + Skeleton + 错误处理
- [ ] 6.7.2 AuditLogs.vue - Toast + Skeleton + 错误处理
- [ ] 6.7.3 R18Whitelist.vue - Toast + Skeleton + 错误处理
- [ ] 6.7.4 Crawlers.vue - Toast + Skeleton + 错误处理
- [ ] 6.7.5 Settings.vue - Toast + 错误处理

## 7. 测试

### 7.1 Toast 系统测试

- [ ] 7.1.1 创建 `useToast.test.ts` 单元测试
- [ ] 7.1.2 测试 showToast 方法（创建 Toast）
- [ ] 7.1.3 测试 hideToast 方法（关闭 Toast）
- [ ] 7.1.4 测试自动消失（setTimeout）
- [ ] 7.1.5 测试队列限制（最多 5 个）
- [ ] 7.1.6 测试 Progress Toast（更新进度）

### 7.2 Toast 组件测试

- [ ] 7.2.1 创建 `Toast.vue` 组件测试
- [ ] 7.2.2 测试四种类型渲染
- [ ] 7.2.3 测试关闭按钮点击
- [ ] 7.2.4 测试动画效果
- [ ] 7.2.5 测试响应式布局

### 7.3 骨架屏测试

- [ ] 7.3.1 创建 `SkeletonTable.vue` 组件测试
- [ ] 7.3.2 测试 props 配置（rows, columns, widths）
- [ ] 7.3.3 测试闪烁动画
- [ ] 7.3.4 创建 `SkeletonCard.vue` 组件测试
- [ ] 7.3.5 测试三种变体（stat/content/image）

### 7.4 错误处理测试

- [ ] 7.4.1 创建 `useErrorHandler.test.ts` 单元测试
- [ ] 7.4.2 测试 parseError 方法（各种错误类型）
- [ ] 7.4.3 测试 getErrorMessage 方法（消息映射）
- [ ] 7.4.4 测试 handleError 方法（集成 Toast）
- [ ] 7.4.5 创建 `ErrorDisplay.vue` 组件测试
- [ ] 7.4.6 测试三种展示模式（inline/banner/modal）

### 7.5 集成测试

- [ ] 7.5.1 测试 Movies.vue 的完整流程（Toast + Skeleton + 错误）
- [ ] 7.5.2 测试批量操作的进度反馈
- [ ] 7.5.3 测试网络错误场景（断网重试）
- [ ] 7.5.4 测试权限错误场景（403 提示）

## 8. 国际化

### 8.1 中文翻译

- [ ] 8.1.1 在 `locales/zh.json` 添加 Toast 相关翻译
- [ ] 8.1.2 在 `locales/zh.json` 添加错误消息翻译
- [ ] 8.1.3 在 `locales/zh.json` 添加操作按钮翻译

### 8.2 英文翻译

- [ ] 8.2.1 在 `locales/en.json` 添加 Toast 相关翻译
- [ ] 8.2.2 在 `locales/en.json` 添加错误消息翻译
- [ ] 8.2.3 在 `locales/en.json` 添加操作按钮翻译

### 8.3 集成测试

- [ ] 8.3.1 测试中文环境下的所有消息
- [ ] 8.3.2 测试英文环境下的所有消息
- [ ] 8.3.3 测试语言切换时的消息更新

## 9. 文档

### 9.1 组件文档

- [ ] 9.1.1 在 Toast.vue 中添加 JSDoc 注释
- [ ] 9.1.2 在 SkeletonTable.vue 中添加使用示例
- [ ] 9.1.3 在 SkeletonCard.vue 中添加使用示例
- [ ] 9.1.4 在 ErrorDisplay.vue 中添加使用示例

### 9.2 Composable 文档

- [ ] 9.2.1 在 useToast.ts 中添加详细注释和示例
- [ ] 9.2.2 在 useErrorHandler.ts 中添加详细注释和示例
- [ ] 9.2.3 创建 USAGE.md 说明如何在新页面中集成

### 9.3 迁移指南

- [ ] 9.3.1 创建 MIGRATION.md 记录迁移步骤
- [ ] 9.3.2 列出需要替换的模式（alert → Toast）
- [ ] 9.3.3 提供迁移脚本（批量查找替换 alert）

## 10. 验证和优化

### 10.1 功能验证

- [ ] 10.1.1 验证所有 Toast 类型正常显示
- [ ] 10.1.2 验证骨架屏与真实内容高度一致
- [ ] 10.1.3 验证错误处理覆盖所有场景
- [ ] 10.1.4 验证批量操作进度反馈
- [ ] 10.1.5 验证无障碍性（ARIA + 键盘导航）

### 10.2 性能检查

- [ ] 10.2.1 检查 Toast 动画性能（60fps）
- [ ] 10.2.2 检查骨架屏动画性能（GPU 加速）
- [ ] 10.2.3 检查多 Toast 场景下的内存占用
- [ ] 10.2.4 优化 CSS 动画（使用 transform 而非 left/top）

### 10.3 浏览器兼容性

- [ ] 10.3.1 测试 Chrome 最新版
- [ ] 10.3.2 测试 Firefox 最新版
- [ ] 10.3.3 测试 Safari 最新版
- [ ] 10.3.4 测试 Edge 最新版
- [ ] 10.3.5 测试移动端 Safari/Chrome

### 10.4 响应式测试

- [ ] 10.4.1 测试桌面端（1920x1080）
- [ ] 10.4.2 测试平板端（768x1024）
- [ ] 10.4.3 测试移动端（375x667）
- [ ] 10.4.4 测试极端屏幕尺寸（4K / 小屏手机）

## 11. 部署

### 11.1 代码审查

- [x] 11.1.1 自查所有新增文件的 ESLint 问题
- [x] 11.1.2 自查 TypeScript 类型安全
- [x] 11.1.3 检查无 console.log 残留（除 errorHandler）
- [x] 11.1.4 检查代码注释完整性

### 11.2 提交代码

- [x] 11.2.1 提交核心组件和 composables
- [x] 11.2.2 提交 Movies.vue 和 Home.vue 集成
- [x] 11.2.3 提交其他页面迁移
- [ ] 11.2.4 提交测试文件
- [ ] 11.2.5 提交文档

### 11.3 生产部署

- [x] 11.3.1 合并到 main 分支
- [x] 11.3.2 触发 Cloudflare Pages 部署
- [x] 11.3.3 验证生产环境 Toast 正常显示
- [x] 11.3.4 验证生产环境骨架屏正常加载
- [ ] 11.3.5 监控前端错误日志（是否有新错误）

### 11.4 监控和反馈

- [ ] 11.4.1 监控首日用户反馈
- [ ] 11.4.2 检查 Toast 显示频率（是否过多）
- [ ] 11.4.3 检查错误处理覆盖率（是否有未捕获错误）
- [ ] 11.4.4 根据反馈调整 Toast 时长和样式

## 12. 清理

### 12.1 代码清理

- [ ] 12.1.1 移除所有被替换的 alert() 调用
- [ ] 12.1.2 移除所有直接的 console.error() 调用
- [ ] 12.1.3 移除临时调试代码

### 12.2 文档更新

- [ ] 12.2.1 更新 Dashboard README（说明新增的反馈系统）
- [ ] 12.2.2 更新组件清单（列出新增组件）
- [ ] 12.2.3 创建变更日志（记录用户体验改进）

---

## 进度追踪

- **总任务数**：137 个子任务
- **已完成**：0 个任务
- **阶段划分**：
  - Phase 1：核心组件（任务 1-3）
  - Phase 2：试点集成（任务 4-5）
  - Phase 3：全面迁移（任务 6）
  - Phase 4：测试优化（任务 7-10）
  - Phase 5：部署清理（任务 11-12）

## 验收标准

- ✅ 所有页面不再使用 alert()
- ✅ 所有列表页面使用骨架屏
- ✅ 所有错误都有友好提示
- ✅ 批量操作有进度反馈
- ✅ 单元测试覆盖率 > 80%
- ✅ 无障碍性检查通过
- ✅ 国际化支持（中/英）
- ✅ 生产环境运行稳定
