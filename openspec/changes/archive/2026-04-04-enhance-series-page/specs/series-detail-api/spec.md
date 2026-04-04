# series-detail-api

## 描述

提供系列详情聚合查询，返回系列统计数据和所属厂商信息。

## Requirements

- REQ-1: `GET /api/series/:name` 端点 MUST 返回系列的影片数量（movieCount）、总时长（totalDuration 秒）、最早和最新发行年份
- REQ-2: 端点 MUST 返回系列所属厂商信息（name 和 slug），slug 用于生成厂商详情页链接
- REQ-3: 系列不存在（无匹配影片）时 MUST 返回 404
- REQ-4: totalDuration 为 null（影片无时长数据）时 SHALL 返回 0
- REQ-5: 端点 MUST 遵循 R18 过滤规则，未验证用户的统计数据排除 R18 影片
- REQ-6: `GET /api/movies?series=` 端点 SHALL 新增 `sort=releaseDate&order=desc` 参数，按发行日期排序
