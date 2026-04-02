## ADDED Requirements

### Requirement: 详情页标签 MUST 可点击筛选
`MovieDetail.vue` 中的 genre 标签 SHALL 渲染为可点击元素，点击后跳转到首页并应用该标签筛选。

#### Scenario: 点击标签跳转筛选
- **WHEN** 用户在影片详情页点击某个 genre 标签
- **THEN** 系统 MUST 导航到 `/?genre=标签名`，首页列表自动按该标签筛选

#### Scenario: 首页读取 URL 中的 genre 参数
- **WHEN** 用户通过 URL `/?genre=xxx` 进入首页
- **THEN** 首页 SHALL 自动将 genre 参数应用到筛选条件，显示对应结果
