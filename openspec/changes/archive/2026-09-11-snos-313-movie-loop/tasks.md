# 任务

- [x] 1.1 抽出 JavBus 影片/女优/發行商纯解析并加 fixture 测试；完成标准：SSIS-001 fixture 解析出 label/9x 与 studio/7q。
- [x] 1.2 电影爬虫支持 seedMovieUrls/详情 startUrl；完成标准：定向测试覆盖种子模式，不跑列表页。
- [x] 1.3 入库同时关联製作商和發行商，并收集女优/厂商 sourceUrl；完成标准：sync 测试覆盖双厂商。
- [x] 1.4 發行商列表页可解析身份且不破坏现有 logo 回退；完成标准：无 logo 时仍返回 name/sourceId。
- [x] 2.1 管理端女优/厂商支持创建和删除 API；完成标准：路由测试覆盖 404/成功。
- [x] 2.2 Dashboard 影片/女优/厂商增删改入口可用；完成标准：组件能发起对应 API。
- [x] 3.1 用 SNOS-313 经 Gateway 验证爬取、入库、磁链、预览图、女优、發行商、播放和管理端 CRUD；完成标准：D1 readback 与浏览器证据齐全。

