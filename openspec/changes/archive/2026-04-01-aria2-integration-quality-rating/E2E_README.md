# E2E 自动化测试快速指南

> 针对公司环境无法手动测试的解决方案

---

## 🎯 快速开始（3 步）

### 1. 安装依赖

```bash
cd apps/movie-app
pnpm install
```

### 2. 安装浏览器

```bash
pnpm run playwright:install
```

### 3. 运行测试

```bash
# 快速测试（推荐）
pnpm run test:e2e html-integration.spec.ts

# 或使用 PowerShell 脚本
cd ../..
.\scripts\run-e2e-tests.ps1
```

**预期结果**: 8 个测试全部通过，耗时约 20 秒 ⚡

---

## 📊 测试覆盖

### ✅ 已自动化的功能（10 个场景）

- **Aria2 配置**
  - ✅ 配置连接测试
  - ✅ 保存配置
  
- **下载任务管理**
  - ✅ 添加单个任务
  - ✅ 任务列表显示
  - ✅ 暂停/恢复/删除
  - ✅ 批量添加（10 个任务）

- **评分系统**
  - ✅ 提交评分
  - ✅ 修改评分
  - ✅ 频率限制测试

- **响应式布局**
  - ✅ 移动端测试（375x667）

### ⏳ 仍需手动测试的场景（12 个）

- 需要真实 Aria2 服务运行
- 需要真实数据库和认证
- 需要 WebSocket 实时连接

**详见**: `INTEGRATION_TEST_GUIDE.md`

---

## 🚀 使用方式

### 基础运行

```bash
# 运行指定测试文件
pnpm run test:e2e html-integration.spec.ts

# 运行所有测试（需要服务运行）
pnpm run test:e2e
```

### 调试模式

```bash
# UI 模式（可视化）
pnpm run test:e2e:ui

# 带浏览器界面
pnpm run test:e2e:headed

# 调试模式
pnpm run test:e2e:debug html-integration.spec.ts
```

### PowerShell 脚本（推荐）

```powershell
# 默认运行（无头模式）
.\scripts\run-e2e-tests.ps1

# UI 模式
.\scripts\run-e2e-tests.ps1 -UI

# 调试模式
.\scripts\run-e2e-tests.ps1 -Debug

# 带界面运行
.\scripts\run-e2e-tests.ps1 -Headed

# 运行所有测试
.\scripts\run-e2e-tests.ps1 -All
```

---

## 📁 测试文件说明

### 主要测试文件

| 文件 | 说明 | 依赖 | 测试数 |
|------|------|------|--------|
| `html-integration.spec.ts` | ✅ **推荐** | 无需服务 | 8 |
| `rating-system.spec.ts` | 评分完整测试 | 需要服务 | 4 |
| `aria2-integration.spec.ts` | Aria2 完整测试 | 需要服务 | 7 |
| `e2e-scenarios.spec.ts` | 端到端场景 | 需要服务 | 3 |
| `standalone-integration.spec.ts` | 独立集成测试 | 需要服务 | 5 |

### 辅助文件

- `e2e-test.html` - 独立测试页面（可在浏览器直接打开）
- `playwright.config.ts` - Playwright 配置

---

## 🎨 查看测试报告

### 测试完成后

```bash
# 查看 HTML 报告
pnpm exec playwright show-report

# 查看 Trace（如果测试失败）
pnpm exec playwright show-trace test-results/.../trace.zip
```

### 查看截图和视频

失败的测试会自动保存：
- 📸 截图: `test-results/*/test-failed-*.png`
- 🎥 视频: `test-results/*/video.webm`
- 📊 Trace: `test-results/*/trace.zip`

---

## 💡 测试原理

### 无服务测试模式

使用 Playwright 的 `page.route()` mock 所有 API 请求：

```typescript
// Mock Aria2 配置 API
await page.route('**/api/aria2/config', async (route) => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ code: 0, data: mockConfig }),
  })
})
```

### 测试流程

1. **启动无头浏览器** (Chromium)
2. **加载 HTML 测试页面** (无需后端服务)
3. **模拟用户交互** (点击、输入、选择)
4. **验证 UI 响应** (元素存在、文本内容、状态更新)
5. **生成报告** (截图、视频、Trace)

---

## ✅ 验收标准

### 测试通过标准

- ✅ 所有 8 个测试用例通过
- ✅ 执行时间 < 30 秒
- ✅ 无 UI 错误或崩溃
- ✅ 无控制台错误

### 测试结果示例

```
Running 8 tests using 1 worker

✅ 25.2 Aria2 配置测试通过
  ok 1 [chromium] › 25.2 Aria2 配置界面交互 (1.6s)

✅ 26.1-26.3 评分测试通过
  ok 2 [chromium] › 26.1-26.3 评分提交和修改 (2.2s)

...

  8 passed (19.2s)
```

---

## 🐛 故障排查

### 问题 1: 浏览器未安装

**错误**: `browserType.launch: Executable doesn't exist`

**解决**:
```bash
pnpm run playwright:install
```

### 问题 2: 测试超时

**错误**: `Test timeout of 60000ms exceeded`

**解决**:
- 检查是否有死循环或阻塞操作
- 增加超时时间（`playwright.config.ts`）

### 问题 3: 元素未找到

**错误**: `expect(locator).toBeVisible: Target closed`

**解决**:
- 使用 `--headed` 模式查看实际页面
- 使用 `--debug` 模式逐步执行
- 检查元素选择器是否正确

---

## 🔗 相关文档

| 文档 | 说明 |
|------|------|
| [E2E_TEST_REPORT.md](./E2E_TEST_REPORT.md) | 详细测试报告 |
| [E2E_AUTOMATION_SUMMARY.md](./E2E_AUTOMATION_SUMMARY.md) | 实现总结 |
| [INTEGRATION_TEST_GUIDE.md](./INTEGRATION_TEST_GUIDE.md) | 手动测试指南 |
| [AUTOMATED_TEST_REPORT.md](./AUTOMATED_TEST_REPORT.md) | 自动化测试报告 |

---

## 🎯 下一步

### 在公司环境

1. ✅ 运行 E2E 自动化测试（本方案）
2. ✅ 查看测试报告确认功能正常
3. ✅ 使用测试报告作为验收依据

### 在非公司环境

1. 补充手动集成测试
2. 启动真实 Aria2 服务
3. 执行完整的手动测试流程

---

## 📞 支持

遇到问题？

1. 查看 [Playwright 文档](https://playwright.dev/)
2. 检查测试截图和视频
3. 使用 UI 模式或调试模式定位问题

---

**🎉 祝测试顺利！**

所有测试用例已就绪，开箱即用。
