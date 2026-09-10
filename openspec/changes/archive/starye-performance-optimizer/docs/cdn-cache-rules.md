# Cloudflare CDN 缓存规则配置指南

## 静态资源缓存规则

### CSS 和 JavaScript 文件
**规则名称**: Static Assets Cache
**匹配模式**: `*.(css|js)$`
**缓存级别**: Standard
**TTL**: 1 年（31536000 秒）
**缓存键**: 忽略查询字符串
**浏览器缓存 TTL**: 1 年

### 图片文件
**规则名称**: Images Cache
**匹配模式**: `*.(jpg|jpeg|png|gif|webp|avif|svg)$`
**缓存级别**: Standard
**TTL**: 1 年（31536000 秒）
**缓存键**: 忽略查询字符串
**浏览器缓存 TTL**: 1 年

### 字体文件
**规则名称**: Fonts Cache
**匹配模式**: `*.(woff|woff2|ttf|otf|eot)$`
**缓存级别**: Standard
**TTL**: 1 年（31536000 秒）
**缓存键**: 忽略查询字符串
**浏览器缓存 TTL**: 1 年

## API 响应缓存规则

### GET 请求
**规则名称**: API GET Cache
**匹配模式**: `/api/*`
**方法**: GET
**缓存级别**: Standard
**TTL**: 5 分钟（300 秒）
**缓存键**: 包含查询字符串和 Cookie（用户级别）

### 管理端点（不缓存）
**规则名称**: Admin No Cache
**匹配模式**: `/api/admin/*`
**缓存级别**: Bypass
**TTL**: 0

## Page Rules 配置

### 首页和主要页面
**规则**: `https://starye.org/*`
- 缓存级别: Standard
- 浏览器缓存 TTL: 2 小时
- 启用 Always Online

### API 路由
**规则**: `https://api.starye.org/*`
- 缓存级别: Standard
- 缓存按查询字符串和 Cookie 分离
- 禁用 Always Online

### 静态资源
**规则**: `https://cdn.starye.org/*`
- 缓存级别: Cache Everything
- Edge Cache TTL: 1 个月
- 浏览器缓存 TTL: 1 年
- 启用 Auto Minify（HTML/CSS/JS）

## Cache-Control 头配置

### 静态资源（immutable）
```http
Cache-Control: public, max-age=31536000, immutable
```

### 可变资源
```http
Cache-Control: public, max-age=3600, must-revalidate
```

### API 响应
```http
Cache-Control: public, max-age=300, s-maxage=300
```

### 管理页面
```http
Cache-Control: no-store, no-cache, must-revalidate, private
```

## 实施步骤

1. 登录 Cloudflare 控制台
2. 选择 starye.org 域名
3. 导航到 Caching > Cache Rules
4. 添加上述缓存规则
5. 导航到 Caching > Configuration
6. 启用 Always Online
7. 导航到 Rules > Page Rules
8. 添加上述 Page Rules

## 验证方法

1. 使用 `curl -I` 检查响应头
2. 使用 Chrome DevTools Network 面板检查缓存状态
3. 使用 Cloudflare Analytics 监控缓存命中率