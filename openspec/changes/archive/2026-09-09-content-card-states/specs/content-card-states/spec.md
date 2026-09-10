## ADDED Requirements
### Requirement: Explicit media states
卡片 SHALL 区分权限受限、封面缺失、图片加载失败和正常图片，并保持尺寸稳定。
#### Scenario: Restricted content with cached URL
- **WHEN** restricted 为 true 且传入 cover
- **THEN** 不创建图片元素，显示权限提示及锁图标
#### Scenario: Broken cover replaced
- **WHEN** 图片 error 后 cover URL 更新
- **THEN** 显示新的图片，失败状态不继承
#### Scenario: Verified R18 content without cover
- **WHEN** restricted 为 false 且 cover 为空
- **THEN** 显示缺图提示而非权限受限提示
### Requirement: Scannable accessible cards
电影卡片 SHALL 使用固定横版比例，卡片标题 SHALL 限制两行且提供完整 title，键盘用户 SHALL 看到焦点反馈。
#### Scenario: Keyboard navigation
- **WHEN** 卡片链接获得键盘焦点
- **THEN** 可见焦点环且 Enter 仍可导航
