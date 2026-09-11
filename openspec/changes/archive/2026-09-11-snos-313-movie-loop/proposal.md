## Why
电影闭环已有 JavBus 详情、磁链、女优/厂商同步和管理端编辑，但不能指定单部影片验收。SNOS-313 需要从爬取到入库、磁链、预览图、女优、發行商和管理端增删改一次跑通。

## What Changes
- 电影爬虫 MUST 支持种子影片 URL，可只爬取 SNOS-313 这类详情页。
- 入库 MUST 同时关联製作商和發行商，并保留女优 sourceUrl。
- JavBus 發行商/製作商列表页 MUST 能解析身份信息，即使没有 logo。
- 管理端 MUST 能对影片、女优、厂商做创建/更新/删除，并以 D1 readback 为准。

## Non-goals
不改漫画爬虫，不改 Quant，不把 JavBus 列表页全站爬取策略换成种子模式。

## Impact
涉及 crawler JavBus 策略/电影爬虫、电影同步、Dashboard 影片/女优/厂商管理和播放验收。风险：种子 URL 误判会跳过列表爬取；發行商关联不得覆盖已有製作商。
