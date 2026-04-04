# player-enrich-script

## 描述

独立的播放源补充脚本，对数据库中已存在但无播放源的影片，通过 JavDB 策略批量补爬磁力链接。

## Requirements

- REQ-1: 脚本 MUST 通过 API 查询 `totalPlayers = 0` 的影片列表（支持 `--limit` 参数）
- REQ-2: 对每个影片 code，脚本 SHALL 使用 JavDB 策略搜索并提取磁力链接
- REQ-3: 成功提取的 players MUST 通过 `POST /api/movies/sync` 写入数据库
- REQ-4: 脚本 MUST 支持 `--dry-run` 模式，只打印不写入
- REQ-5: 脚本 SHALL 记录每个影片的处理结果（成功/失败/无结果）
- REQ-6: 对 JavDB 请求 MUST 使用合理延迟（3-6 秒），避免触发反爬
