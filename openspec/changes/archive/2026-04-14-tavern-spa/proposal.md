# 提案: Starye Tavern (本地化网关集成)

## 目标
利用现成的 Starye Dashboard 界面和 Cloudflared Tunnel(或者本地 Gateway)，将业界顶级的开源角色扮演平台 **SillyTavern(酒馆)** 无缝集成进入 Starye 生态系统。
实现零前端开发成本下，获得极致的私有安全、NSFW 兼容且功能完备的 Roleplay 体验。

## 现状与动机
原计划从零用 Vue 构建一个轻量的 RP 单页应用(`apps/tavern`)。但经评估，重写一个具备类似 SillyTavern 用户体验的前端 (涵盖 V2/V3 卡片解析、正则表达式替换、世界书触发器等) 的时间与维护成本过大。
放弃自研 SPA，转而**直接运行本地原生 SillyTavern 服务**，用 Cloudflare Tunnel 或在网关层反向代理。

## 拟议的更改

本次工程是对外部基础设施的整合：

### 1. 废弃数据库与后端 API
不需要在 D1 创建任何会话与卡片表，也不需要在 Hono 里写转发代理。数据完全驻留在运行 SillyTavern 的本地文件系统中，做到绝对隐私。

### 2. 建立公网/本地代理隧道 (Gateway / Tunnel)
- **方案 A (强安全)**：通过 Cloudflare Tunnel (`cloudflared`) 将本地 SillyTavern (默认 8000 端口) 穿透至域名 `tavern.starye.com`。通过 Cloudflare Zero Trust (Access) 进行访客拦截，仅允许本人 GitHub 账号访问。
- **方案 B (简单版)**：在现有的 `apps/gateway` 服务中增加一条代理规则，开发环境下直接转发 `/tavern` 到 `127.0.0.1:8000`。

### 3. Dashboard 集成入口
- 借用已被搭建好的 `apps/dashboard` 管理台。
- 在侧边栏新增一个入口 `Tavern`，点击后直接在主视图的 `<iframe src="https://tavern.你的域名.com">` 中全屏呈现酒馆 UI，或默认新标签页打开，做到多应用入口归一化。

## 成功指标 (Success Criteria)
1. 不需要写任何聊天气泡/复杂页面的前端代码。
2. 通过 Starye Dashboard 点击能直接打开完整版 SillyTavern，并通过 Zero Trust 拦截非法访问。
3. 可无缝调用 OpenRouter API，并在手机端公网稳定使用。
