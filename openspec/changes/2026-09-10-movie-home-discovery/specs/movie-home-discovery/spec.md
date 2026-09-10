## ADDED Requirements

### Requirement: URL 可恢复筛选
首页主列表筛选状态 MUST 完整收敛到 URL。

#### Scenario: 刷新后恢复
- **WHEN** 用户刷新或分享带筛选的首页 URL
- **THEN** 页面恢复相同搜索、筛选、排序和分页

### Requirement: 扩展搜索
搜索 MUST 匹配番号、标题、演员、厂商和系列。

#### Scenario: 演员或系列命中
- **WHEN** 用户搜索演员名或系列名
- **THEN** 列表返回对应影片

### Requirement: 可解释发现入口
系统 MUST 提供最近新增、最近更新、播放验证通过和继续观看入口；匿名推荐 MUST 标明非个性化。

#### Scenario: 匿名热门不伪装个性化
- **WHEN** 未登录用户打开首页
- **THEN** 热门或最近新增入口标明公开策略，不显示为个性化推荐
