# Movie-App 文档中心

欢迎来到 Starye Movie-App 的技术文档！

## 📚 文档导航

### 组件文档

核心 UI 组件的使用指南和 API 文档：

- **[Select](./components/Select.md)** - 自定义下拉选择器，支持泛型和键盘导航
- **[MobileDrawer](./components/MobileDrawer.md)** - 移动端抽屉菜单，从左侧滑出
- **[BottomNavigation](./components/BottomNavigation.md)** - 底部导航栏，支持 Safe Area
- **[DrawerFooter](./components/DrawerFooter.md)** - 抽屉底部信息栏

### API 文档

后端 API 接口文档：

- **[收藏夹 API](./api/favorites.md)** - 完整的收藏功能 CRUD 接口

### 测试文档

- **[E2E 测试指南](../E2E-TEST-GUIDE.md)** - Playwright E2E 测试运行说明
- **[单元测试](./testing/unit-tests.md)** - Vitest 单元测试指南

### 开发指南

- **[移动端优化](./guides/mobile-optimization.md)** - 移动端开发最佳实践
- **[响应式设计](./guides/responsive-design.md)** - 响应式断点和适配策略

## 🚀 快速开始

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
# 启动开发服务器（端口 3001）
pnpm dev

# 启动后端 API（端口 3000）
pnpm --filter api dev
```

### 构建生产版本

```bash
pnpm build
```

### 运行测试

```bash
# 单元测试
pnpm test

# E2E 测试（需要先启动服务）
pnpm test:e2e

# 测试覆盖率
pnpm test:coverage
```

### 类型检查

```bash
pnpm vue-tsc --noEmit
```

## 📱 移动端特性

### 响应式断点

```typescript
// 768px 及以下为移动端
const isMobile = window.innerWidth <= 768

// 1024px 及以下为平板
const isTablet = window.innerWidth <= 1024
```

### Safe Area 支持

所有移动端组件都已适配 iPhone 底部安全区域：

```css
.component {
  padding-bottom: calc(1rem + env(safe-area-inset-bottom));
}
```

### 移动端导航

- **底部导航栏**：3 个主要入口（首页/女优/我的）
- **抽屉菜单**：次要功能（厂商/收藏夹/设置）
- **顶部搜索**：搜索图标（点击跳转搜索页）

## 🎨 设计规范

### 颜色系统

```css
/* 主题色 */
--primary: #4ade80;
--primary-dark: #22c55e;

/* 背景色 */
--bg-dark: #1a1a1a;
--bg-darker: #0f0f0f;
--bg-card: #262626;

/* 文本色 */
--text-primary: #ffffff;
--text-secondary: #a3a3a3;
```

### 间距规范

- **xs**: 0.25rem (4px)
- **sm**: 0.5rem (8px)
- **md**: 1rem (16px)
- **lg**: 1.5rem (24px)
- **xl**: 2rem (32px)

### 圆角规范

- **sm**: 0.25rem (4px)
- **md**: 0.5rem (8px)
- **lg**: 0.75rem (12px)
- **xl**: 1rem (16px)

## 🛠️ 技术栈

- **框架**: Vue 3.5 (Composition API)
- **路由**: Vue Router 5.0
- **状态管理**: Pinia 3.0
- **类型系统**: TypeScript 6.0
- **样式方案**: Tailwind CSS 4.0
- **构建工具**: Vite 8.0
- **测试框架**: Vitest 4.1 + Playwright 1.58
- **HTTP 客户端**: Axios 1.14

## 📊 项目统计

- **组件数量**: 20+
- **Composables**: 10+
- **单元测试**: 110 个（100% 通过）
- **E2E 测试**: 18 个
- **Type-check**: ✅ 全部通过

## 🔗 相关链接

- [项目仓库](https://github.com/yourusername/starye)
- [问题反馈](https://github.com/yourusername/starye/issues)
- [变更日志](../../CHANGELOG.md)

## 📝 最近更新

### v1.0.0 - 移动端 UI 优化（2026-03-31）

**新增功能**：
- ✅ 移动端底部导航
- ✅ 抽屉式菜单
- ✅ 自定义下拉选择器
- ✅ 收藏夹功能
- ✅ Safe Area 适配

**技术改进**：
- ✅ TypeScript 泛型支持
- ✅ 完整单元测试覆盖
- ✅ E2E 测试套件
- ✅ 响应式设计优化

---

**维护者**：Starye Team  
**最后更新**：2026-03-31
