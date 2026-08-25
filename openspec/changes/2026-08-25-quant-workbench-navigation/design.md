# 设计

## 信息架构

| 视图 | 主要任务 | 首屏内容 |
| --- | --- | --- |
| 总览 | 判断今天从哪里开始 | 统计、优先关注、风险提示、研究路径 |
| 候选研究 | 筛选、比较、打开分析抽屉 | 预设、筛选、复查队列、候选表 |
| 观察池 | 管理标的并更新日线 | 加入/删除、观察池表、同步结果 |
| 因子框架 | 理解评分依据和数据缺口 | 因子状态、量化方向、来源映射 |

## 状态模型

- `QuantView = overview | candidates | watchlist | knowledge`。
- 视图通过 URL hash 持久化：`#overview`、`#candidates`、`#watchlist`、`#knowledge`。
- 非法或缺失 hash 回退到 `overview`。
- Header 在桌面显示横向导航，在移动端使用菜单展开；切换视图时关闭移动菜单。

## 组件边界

- `QuantHeader.vue`：品牌、视图导航、数据截至日期、刷新按钮和移动菜单。
- `quant-view.ts`：视图类型、合法值解析和 hash 映射。
- `App.vue`：继续持有数据加载和抽屉状态；根据 `activeView` 显示既有业务区域。

## 视觉与响应式

- Header 使用与 Movie/Comic 相同的 sticky、边框、半透明背景和最大宽度。
- Quant 保留现有浅色数据工作台 token，不复制其他子应用的业务色板。
- 移动端导航可横向滚动或折叠菜单；表格仍在自身容器内横向滚动，页面主体不产生横向溢出。
- 图标按钮保留 `aria-label` 和 `title`，导航按钮使用 `aria-current`。
