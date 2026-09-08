## ADDED Requirements

### Requirement: Movie images follow existing R18 access
电影列表、热门、公开列表、推荐、详情及电影/演员详情的关联电影 SHALL 对不具备现有 R18 权限的用户隐藏 R18 封面和预览图地址，同时保留普通内容图片与目录文字。

#### Scenario: Anonymous or unverified request
- **WHEN** 匿名用户或未验证登录用户请求含 R18 条目的电影接口
- **THEN** R18 条目的 coverImage 为 null，存在图集字段时 previewImages 为 []
- **AND** 关联条目按自己的 isR18 判断，非 R18 图片保持原值

#### Scenario: Verified request
- **WHEN** 用户满足现有 R18 权限判定
- **THEN** 封面和封面优先去重后的详情图集正常返回

### Requirement: Protected responses and rendering are session isolated
电影 API SHALL 阻止含受限图片的响应跨会话复用，Movie 前端 SHALL 在未取得 R18 权限时不创建受限封面或预览图的图片元素。

#### Scenario: Response caching
- **WHEN** 任意身份读取电影列表、详情、热门或推荐
- **THEN** 响应使用 private, no-store，并包含 Vary: Cookie

#### Scenario: Restricted detail display
- **WHEN** 匿名或未验证用户打开 R18 详情，即使客户端持有旧图片字段
- **THEN** 主封面、预览图集和受限关联封面不产生图片元素，界面显示 R18 访问提示
