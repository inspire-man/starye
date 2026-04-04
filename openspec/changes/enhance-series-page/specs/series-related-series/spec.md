# series-related-series

## 描述

在系列页面展示同厂商下其他系列的快捷入口，帮助用户发现相关内容。

## Requirements

- REQ-1: 系列详情 API 响应 MUST 包含 `relatedSeries: string[]`，内容为同厂商的其他系列名（最多 8 个）
- REQ-2: 相关系列列表 MUST 排除当前系列自身
- REQ-3: 若系列无所属厂商信息，relatedSeries MUST 返回空数组
- REQ-4: 前端系列页底部 MUST 展示相关系列链接，点击跳转 `/series/:encodedName`
- REQ-5: relatedSeries 为空时 SHALL 不展示该区域（隐藏而非显示空列表）
