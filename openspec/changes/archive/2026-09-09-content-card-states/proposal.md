## Why
目录卡片将 R18 缺图和权限受限混为一谈，加载失败留下破图；电影横版封面被竖版裁切，长标题列表难以扫描。

## What Changes
- 共享卡片 SHALL 区分受限、缺图、加载失败和有效图片，URL 更新后重新加载。
- 电影使用 4:3 完整图片，漫画保持 3:4，标题稳定两行高度，增加键盘焦点。
- 电影首页/新片/搜索/系列和漫画首页/搜索显式传入现有权限状态。

## Capabilities
### New Capabilities
- `content-card-states`: 卡片媒体状态与可访问性。
### Modified Capabilities

## Impact
仅 UI 组件和 Movie/Comic 调用方；无 API 或 D1 修改。沿用各应用既有权限判定，不授予额外权限。
