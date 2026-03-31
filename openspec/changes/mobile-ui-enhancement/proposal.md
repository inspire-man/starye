# 移动端 UI 体验优化

## 问题描述

当前 Movie-App 和 Dashboard 在移动端存在严重的可用性问题：

### Movie-App 客户端

1. **导航功能完全缺失**
   - Header 中的主导航菜单使用 `hidden md:flex`，在移动端完全不可见
   - 用户无法访问：首页、女优列表、厂商列表、搜索功能
   - R18 状态标签和用户名在移动端隐藏
   - 用户只能通过直接输入 URL 访问不同页面

2. **交互组件不适配**
   - Profile 页面的 5 个 Tab 在移动端需要横向滚动，操作困难
   - 所有筛选和排序使用原生 `<select>`，样式不统一且体验较差

### Dashboard 管理后台

1. **侧边栏占用空间过大**
   - 固定侧边栏始终占据 64px (收起) 或 256px (展开)
   - 移动端主内容区被严重挤压，表格和表单操作困难
   - 没有适配移动端的抽屉式导航

## 解决方案

### 1. Movie-App 移动端导航重构

**底部导航栏（3 Tab）**
- 首页：快速访问影片列表
- 女优：热门演员浏览
- 我的：个人中心（观看历史、下载管理、收藏等）

**抽屉菜单（左侧滑出）**
- 厂商列表
- 收藏夹（新功能）
- 帮助文档
- 关于
- R18 状态展示
- 用户信息展示
- 退出登录

**Header 搜索优化**
- 在 Header 右侧添加搜索图标
- 点击进入全屏搜索模式

### 2. 自定义下拉组件系统

参考 Element Plus 设计规范，创建统一的自定义下拉组件：
- 替换项目中所有原生 `<select>` 组件（共 9 处）
- 支持图标、描述、禁用状态
- 统一的视觉风格和交互体验
- 触摸友好的交互区域

**需要替换的位置**：
- Home.vue: 排序选择器
- Search.vue: 排序选择器
- Actors.vue: 排序/状态/详情筛选（3 处）
- Publishers.vue: 排序/详情筛选（2 处）
- Profile.vue: Tab 选择器 + 下载状态筛选（2 处）

### 3. 收藏夹功能

实现完整的收藏夹系统：
- 数据库表设计
- API 路由（增删改查、批量操作、统计）
- 前端 Composable 和页面
- 多入口访问（抽屉菜单、Profile 页面）

### 4. 移动端适配优化

- iPhone Safe Area 适配
- 底部导航高度考虑 `safe-area-inset-bottom`
- 抽屉宽度：80vw（最大 320px）
- 响应式断点：< 768px 使用移动端布局

### 5. Dashboard 移动端优化（次优先级）

- 侧边栏改为抽屉式（仅移动端）
- 添加汉堡菜单按钮
- 主内容区移动端全宽显示

## 优先级

1. **高优先级**：Movie-App 移动端导航（底部导航 + 抽屉）
2. **高优先级**：自定义下拉组件替换
3. **中优先级**：收藏夹功能
4. **中优先级**：Profile Tab 下拉优化
5. **低优先级**：Dashboard 移动端适配

## 影响范围

### 新增文件
- `apps/movie-app/src/components/Select.vue` - 自定义下拉组件
- `apps/movie-app/src/components/MobileDrawer.vue` - 抽屉组件
- `apps/movie-app/src/components/BottomNavigation.vue` - 底部导航
- `apps/movie-app/src/components/DrawerFooter.vue` - 抽屉底部
- `apps/movie-app/src/composables/useFavorites.ts` - 收藏夹逻辑
- `apps/movie-app/src/composables/useDrawer.ts` - 抽屉状态管理
- `apps/movie-app/src/composables/useMobileDetect.ts` - 移动端检测
- `apps/movie-app/src/views/Favorites.vue` - 收藏夹页面
- `apps/api/src/routes/favorites/index.ts` - 收藏夹 API
- `packages/db/src/schema/favorites.ts` - 收藏夹表

### 修改文件
- `apps/movie-app/src/components/Header.vue` - 添加移动端适配
- `apps/movie-app/src/App.vue` - 集成底部导航和抽屉
- `apps/movie-app/src/views/Profile.vue` - Tab 改为下拉选择器
- `apps/movie-app/src/views/Home.vue` - 替换下拉组件
- `apps/movie-app/src/views/Search.vue` - 替换下拉组件
- `apps/movie-app/src/views/Actors.vue` - 替换下拉组件
- `apps/movie-app/src/views/Publishers.vue` - 替换下拉组件
- `apps/movie-app/src/views/MovieDetail.vue` - 添加收藏按钮

## 预期收益

1. **可用性显著提升**：移动端用户可以正常使用所有功能
2. **一致的交互体验**：统一的下拉组件风格
3. **功能完整性**：收藏夹补齐常见功能缺失
4. **现代化体验**：符合移动端应用的交互习惯

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 组件复杂度增加 | 维护成本上升 | 参考成熟组件库设计，保持 API 简洁 |
| 响应式适配工作量大 | 开发周期延长 | 使用 Tailwind CSS 响应式工具类 |
| 新增数据库表 | 需要迁移 | 提供完整的迁移脚本 |
| Safe Area 适配测试 | 需要真机测试 | 使用浏览器 DevTools 模拟 + 真机验证 |

## 成功标准 MUST

- 移动端用户可以通过底部导航访问核心功能 MUST
- 抽屉菜单可以正常打开/关闭，显示所有次要功能 MUST
- 所有原生 select 组件被替换为自定义组件 MUST
- 收藏夹功能可以正常添加、删除、查看 MUST
- 在 iPhone 上底部导航不被系统栏遮挡 MUST
- Profile 页面 Tab 在移动端使用下拉选择器 MUST
- Dashboard 桌面端功能不受影响 MUST
