# 设计

复用 crawler_task/crawler_run、movie_source_state、movie_source_observation 和 playback_evidence_summary。扫描以 player 实际记录判定缺源，以持久化失败历史计算有上限的重试退避。模板租约限制同时执行数量，扫描结果区分新建、复用、冲突和忙碌。

来源发现必须解析影片编号对应的详情，数据库 ID 不用作来源站点编号。站点失败与空结果分别记录，成功候选继续进入既有 observation 和 revision-bound readback。

补全成功与播放验证分离；只有绑定当前 source revision 且通过 canplay、playing、至少一秒进度的证据可显示已验证可播放。自动调用复用签名控制面，不依赖浏览器 session 或伪造管理员身份。
