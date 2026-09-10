# 播放源自动补全

## Why

现有 repair 运行器已有观察和读回契约，但扫描、来源发现、播放证据和 UI 尚未形成可运行闭环。此前配置地址和静态页面解析不足以完成自动补全。

## What Changes

- 后台按既有任务控制面调度缺少或持续失效的播放源，保留租约、幂等性和失败退避。
- 按影片编号发现 JavDB/JavBus 候选，验证身份并保留来源证据。
- 基于持久化任务和播放证据显示补全状态、连续失败次数与检查时间。
- MUST 用真实影片验证发现、持久化、readback 和 canplay/playing/currentTime。

## Capabilities

### New Capabilities
- `player-repair-automation`: 后台播放源补全、退避和证据展示。

### Modified Capabilities

## Impact

影响 API、crawler、Dashboard、Movie 和工作流。主要风险为跨影片误关联、重复调度和将磁力候选误报为播放成功。保留现有 R18 权限和签名运行控制面，不扩大管理员访问权限。
