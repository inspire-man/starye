## Context
两个共享卡片重复使用 isR18 推断缺图原因，图片没有 error 状态。
## Decisions
新增显式 restricted 属性，默认 false。restricted 优先于 URL；图片失败独立保留，URL 变化时清除失败。直接复用 lucide 图标及 UI tokens。
电影使用 4:3/object-contain，漫画继续 3:4/object-cover。保持卡片链接，避免嵌套交互；标题两行、作者截断、焦点可见。
## Risks
权限属性必须由调用页面提供；服务端权限继续是数据保护边界。跨应用卡片变更通过定向状态测试及浏览器检查。
