# Movie App 文档

这里保留 Movie App 的局部组件说明、用户功能说明和测试入口。跨应用规则、Gateway 入口和测试分层以仓库根文档为准。

## 入口

- [E2E 测试](../E2E-TEST-GUIDE.md)
- [项目测试策略](../../../docs/testing-strategy.md)
- [Aria2 配置](./ARIA2_SETUP_GUIDE.md)
- [评分系统](./RATING_SYSTEM_GUIDE.md)
- [故障排查](./TROUBLESHOOTING.md)
- [收藏功能前端集成](./api/favorites.md)

## 组件

- [Select](./components/Select.md)
- [MobileDrawer](./components/MobileDrawer.md)
- [BottomNavigation](./components/BottomNavigation.md)
- [DrawerFooter](./components/DrawerFooter.md)

## 本地命令

~~~bash
pnpm --filter movie-app run test
pnpm --filter movie-app run test:coverage
pnpm --filter movie-app run build
pnpm --filter movie-app run test:e2e
~~~

Movie App 的诊断端口为 3001。需要浏览器、认证或跨应用验证时，统一从 http://localhost:8080/movie/ 进入。
