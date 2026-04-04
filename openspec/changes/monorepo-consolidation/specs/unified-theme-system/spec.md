## ADDED Requirements

### Requirement: 所有 app 接入统一 CSS 变量体系
所有前端 app（blog、auth、dashboard、movie-app、comic-app）MUST 通过 `@import "@starye/ui/globals.css"` 接入 shadcn/ui CSS 变量体系。globals.css 定义的 `:root` 变量为默认主题，各 app 可通过 `:root` 覆盖品牌色 SHALL。

#### Scenario: Dashboard 接入统一主题
- **WHEN** Dashboard 的 `style.css` 导入 `@starye/ui/globals.css`
- **THEN** 页面中使用 `bg-primary`、`text-muted-foreground` 等 Tailwind class 时，颜色值来自 globals.css 定义的 CSS 变量

#### Scenario: Movie App 品牌色覆盖
- **WHEN** Movie App 的 `style.css` 在导入 globals.css 后通过 `:root` 设置 `--primary: 199 89% 48%`
- **THEN** 页面中所有 `bg-primary` 等 class 显示为天蓝色（sky-500），而非默认深靛蓝

#### Scenario: Comic App 品牌色覆盖
- **WHEN** Comic App 的 `style.css` 在导入 globals.css 后通过 `:root` 设置 `--primary: 25 95% 53%`
- **THEN** 页面中所有 `bg-primary` 等 class 显示为橙色（orange-500）

### Requirement: 删除冗余主题文件
Dashboard 的 `styles/theme.css`（Element Plus 风格色阶）MUST 被删除。Movie App 和 Comic App 的 `tailwind.config.js`（TW v3 配置）MUST 被删除，品牌色通过 `@theme` 或 `:root` 覆盖实现 SHALL。

#### Scenario: Dashboard theme.css 删除后无样式回归
- **WHEN** 删除 `apps/dashboard/src/styles/theme.css` 并将组件中的硬编码色值替换为 Tailwind class
- **THEN** Dashboard 所有页面的视觉效果保持一致（颜色可能略有变化但不影响可用性）

#### Scenario: Movie App tailwind.config.js 删除后品牌色保持
- **WHEN** 删除 `apps/movie-app/tailwind.config.js` 并在 `style.css` 中用 `:root` 覆盖品牌色
- **THEN** Movie App 的 primary 色系仍为天蓝色

### Requirement: Tailwind v4 @theme 配置统一
所有 app MUST 仅通过 `@starye/ui/globals.css` 中的 `@theme` 指令定义 Tailwind 自定义颜色映射，不在各 app 内重复定义 `@theme` 块 SHALL。

#### Scenario: 新 app 接入主题
- **WHEN** 创建新的前端 app 并在入口 CSS 中 `@import "@starye/ui/globals.css"`
- **THEN** 无需任何额外 Tailwind 配置即可使用 `bg-primary`、`text-muted-foreground` 等语义化 class
