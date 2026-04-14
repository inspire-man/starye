## 1. 基础设施准备 (Infrastructure)

- [ ] 1.1 在本地环境中 `git clone` SillyTavern 源码并运行 `npm start`，确保 `localhost:8000` 可用并完成基本的基础配置 (绑定 OpenRouter)。 *(完成标准: 本地浏览器可正常进入酒馆并发起对话)*
- [ ] 1.2 [可选] 启动并配置 `cloudflared tunnel`，将本地 8000 端口穿透为域名 `tavern.your-domain.com`。 *(完成标准: 公网能正常显示页面)*
- [ ] 1.3 [可选] 在 Cloudflare Access Dashboard 建一条 Policy（只允许特定账号访问，或者需要邮箱验证码）。 *(完成标准: 访客公网打开域名时碰到 Cloudflare Access 阻拦页)*

## 2. Gateway 代理（备选 / 本地整合）

- [ ] 2.1 在 `apps/gateway/src/index.ts` 增加反代逻辑：当遇到特定规则或路由前缀时，将通讯直连至 `127.0.0.1:8000` 以备本地调试所用。 *(完成标准: 可以通过 Gateway 端口如 `:3000` 触达酒馆)*

## 3. Dashboard 入口集成 (Starye Integration)

- [x] 3.1 在 `apps/dashboard/src/components/layout/AppSidebar.vue` (或相应的侧边栏组件) 增加一个新的 Menu Item `[角色模拟 (Tavern)]`。 *(完成标准: UI 显示新图标)*
- [x] 3.2 配置菜单逻辑，点击后通过 `window.open` 或配置 External Link 跳转到隧道地址 `https://tavern.your-domain.com`。 *(完成标准: 点击正常且流畅穿过)*

## 4. 环境清理 (Cleanup)

- [x] 4.1 移除之前为了测试在 Vue 代码里新建的无效组件或目录 (如果有)。（注：因为之前未真正创建，故不需清理）
