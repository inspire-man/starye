# E2E 测试运行指南

## 概述

本项目包含完整的 E2E（端到端）测试套件，使用 Playwright 测试框架覆盖移动端 UI 优化功能。

## 前置条件

E2E 测试需要**完整的应用栈**运行：

1. **后端 API 服务**（端口 3000 或配置的端口）
2. **数据库服务**（SQLite 或 D1）
3. **前端应用**（Movie-App，端口 3001）

## 快速开始

### 方法 1：自动启动（推荐用于本地开发）

Playwright 已配置自动启动前端服务，但仍需手动启动后端：

```bash
# 1. 启动后端 API（在项目根目录）
pnpm --filter api dev

# 2. 等待 API 启动完成，然后在新终端运行 E2E 测试
cd apps/movie-app
pnpm test:e2e
```

### 方法 2：全部手动启动（推荐用于 CI）

```bash
# 1. 启动后端 API
pnpm --filter api dev

# 2. 启动前端应用（在新终端）
cd apps/movie-app
pnpm dev

# 3. 运行 E2E 测试（在新终端）
cd apps/movie-app
pnpm test:e2e
```

## 测试范围

### 移动端 UI 测试 (`e2e/mobile-ui.spec.ts`)

覆盖以下功能：

#### 1. 移动端导航
- ✅ 底部导航显示与交互
- ✅ 抽屉菜单打开与关闭
- ✅ 遮罩层点击关闭
- ✅ ESC 键关闭抽屉
- ✅ 抽屉底部 R18 状态显示

#### 2. 自定义 Select 组件
- ✅ Profile 页面 Tab 切换
- ✅ Actors 页面筛选下拉
- ✅ 下拉选项交互

#### 3. 收藏夹功能
- ✅ 添加电影到收藏夹
- ✅ 访问收藏夹页面
- ✅ 收藏列表展示
- ✅ 类型筛选（全部/电影/女优/厂商/漫画）
- ✅ 从收藏夹删除项目

#### 4. 移动端搜索
- ✅ 顶部搜索图标显示
- ✅ 搜索功能交互

#### 5. 响应式断点
- ✅ 桌面端隐藏移动端导航
- ✅ 768px 断点切换
- ✅ 移动端滚动时底部导航固定

#### 6. 抽屉内导航
- ✅ 点击"厂商"导航到厂商页面
- ✅ 点击"收藏夹"导航
- ✅ 导航后自动关闭抽屉

### Dashboard 移动端测试

- ✅ 移动端侧边栏抽屉
- ✅ 桌面端侧边栏始终可见

## 运行特定测试

```bash
# 运行特定文件
pnpm test:e2e e2e/mobile-ui.spec.ts

# 运行特定测试（使用 grep）
pnpm test:e2e --grep "底部导航"

# UI 模式（可视化调试）
pnpm test:e2e:ui

# 有头模式（查看浏览器）
pnpm test:e2e:headed

# 调试模式
pnpm test:e2e:debug
```

## 测试报告

测试完成后，Playwright 会生成以下报告：

- **HTML 报告**：`playwright-report/index.html`
- **JSON 结果**：`test-results/results.json`
- **失败截图**：`test-results/` 目录
- **失败视频**：`test-results/` 目录

查看 HTML 报告：

```bash
pnpm exec playwright show-report
```

## 配置说明

### Playwright 配置 (`playwright.config.ts`)

- **baseURL**: `http://localhost:3001`
- **timeout**: 180 秒（每个测试）
- **retries**: 1 次（失败重试）
- **workers**: 1（串行执行）
- **webServer**: 自动启动前端（120 秒超时）

### 端口配置

- **Movie-App**: 3001
- **Dashboard**: 3002
- **API**: 3000 (或环境变量配置)

## 故障排除

### 问题：连接被拒绝（ERR_CONNECTION_REFUSED）

**原因**：后端 API 或前端应用未启动

**解决**：
1. 检查 API 服务是否运行：`curl http://localhost:3000/health`
2. 检查前端是否运行：`curl http://localhost:3001`
3. 查看终端日志确认服务启动状态

### 问题：测试超时

**原因**：
1. API 响应慢
2. 数据库连接问题
3. 网络问题

**解决**：
- 增加超时配置：`--timeout 300000`
- 检查数据库连接
- 使用 `--debug` 模式查看详细信息

### 问题：找不到元素

**原因**：
1. 选择器不匹配
2. 页面未完全加载
3. API 数据未返回

**解决**：
- 使用 `--headed` 模式查看实际渲染
- 增加 `waitForLoadState('networkidle')`
- 检查 API mock 是否正确

## CI/CD 集成

在 CI 环境中运行 E2E 测试：

```yaml
# GitHub Actions 示例
- name: Install Playwright Browsers
  run: pnpm exec playwright install chromium --with-deps

- name: Start API
  run: pnpm --filter api dev &

- name: Wait for API
  run: npx wait-on http://localhost:3000/health

- name: Run E2E Tests
  run: pnpm --filter movie-app test:e2e
  env:
    CI: true
```

## 与单元测试的关系

- **单元测试**：110 个测试，覆盖组件和 composables 逻辑
- **E2E 测试**：18 个测试，覆盖用户完整流程

**建议**：
- 开发阶段：主要依赖单元测试（快速反馈）
- 部署前：运行完整 E2E 测试（确保集成正确）
- CI/CD：两者都运行

## 更多资源

- [Playwright 官方文档](https://playwright.dev/)
- [Vue Test Utils 文档](https://test-utils.vuejs.org/)
- [项目测试策略](../../docs/testing-strategy.md)

---

**最后更新**：2026-03-31  
**维护者**：Starye Team
