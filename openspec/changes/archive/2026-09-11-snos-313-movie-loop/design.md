# 设计

## 种子爬取
JavBusCrawler 增加 seedMovieUrls。若 startUrl 已是影片详情页（如 /SNOS-313），也视为种子。种子模式只处理这些 URL，然后同步女优/厂商。

## 發行商与製作商
JavBus 中 製作商=studio、發行商=label。电影可关联多个 publisher。同步时同时写入 studio 与 label，label/9x 必须进入 publisher 表。

## 列表页身份
star/label/studio 页是作品列表。女优页有 avatar-box；發行商页通常无 logo。解析 name/sourceId/sourceUrl 即可，logo 仍按现有 R2 规则，没有就不写。

## 管理端 CRUD
影片创建由爬虫完成，管理端负责改/删。女优和厂商补齐创建与删除，删除走 D1 级联并写 audit。
