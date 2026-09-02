# Movie E2E 测试

Movie App 的 E2E 使用 Playwright，测试文件位于 e2e/。测试配置见 playwright.config.ts，当前配置只声明测试目录、浏览器项目和报告器，不自动启动服务，也没有配置 baseURL。

## 运行前提

先启动完整本地栈：

~~~bash
pnpm dev:clean
~~~

浏览器验证统一使用 Gateway：

- Gateway：8080
- API：8787
- Dashboard：5173
- Movie：3001

应用端口只用于诊断。登录、Cookie 和跨应用跳转都通过 http://localhost:8080。

## 常用命令

~~~bash
# CI 当前执行的核心用例
pnpm --filter movie-app run test:e2e html-integration.spec.ts

# 全部 Movie E2E
pnpm --filter movie-app run test:e2e

# 指定用例或调试
pnpm --filter movie-app run test:e2e -- --grep "关键词"
pnpm --filter movie-app run test:e2e:headed
pnpm --filter movie-app run test:e2e:debug
~~~

报告输出到 apps/movie-app/playwright-report/，失败截图、视频和 trace 位于 apps/movie-app/test-results/。

测试分层和验收边界见 ../../docs/testing-strategy.md；本地启动和 Gateway 入口见 ../../README.md。
