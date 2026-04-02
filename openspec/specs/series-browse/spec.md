## ADDED Requirements

### Requirement: 系列浏览路由 MUST 存在
客户端 SHALL 注册 `/series/:name` 路由，指向系列浏览视图。

#### Scenario: 访问系列页面
- **WHEN** 用户通过详情页的系列链接导航到 `/series/某系列`
- **THEN** 系统 MUST 加载并渲染系列浏览页面，而非 404

### Requirement: 系列页面 MUST 列出同系列影片
系列浏览视图 SHALL 调用影片列表 API 筛选同系列影片并展示。

#### Scenario: 系列下有影片
- **WHEN** 系列名称对应多部影片
- **THEN** 页面 MUST 显示所有同系列影片的卡片列表，支持分页

#### Scenario: 系列下无影片
- **WHEN** 系列名称未匹配到任何影片
- **THEN** 页面 SHALL 显示「该系列暂无影片」的友好提示

### Requirement: 路由守卫 MUST 使用 Toast 而非 alert
`router.ts` 中的鉴权拦截 SHALL 使用 `showToast` 显示提示信息，而非 `alert()`。

#### Scenario: 未登录用户访问需鉴权页面
- **WHEN** 未登录用户尝试访问 `/favorites` 等受保护页面
- **THEN** 系统 MUST 显示 Toast 提示「请先登录」，并重定向到首页
