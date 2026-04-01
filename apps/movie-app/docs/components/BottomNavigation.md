# BottomNavigation 底部导航栏

移动端固定底部的导航组件，支持路由高亮、徽章显示和 Safe Area 适配。

## 特性

- ✅ **固定底部**：始终固定在屏幕底部
- ✅ **路由高亮**：自动识别当前激活路由
- ✅ **徽章显示**：支持数字徽章（如未读消息数）
- ✅ **Safe Area 适配**：完美适配 iPhone 底部安全区域
- ✅ **点击动画**：流畅的点击反馈
- ✅ **响应式隐藏**：桌面端自动隐藏
- ✅ **无障碍支持**：完整的键盘和屏幕阅读器支持

## 基础用法

```vue
<script setup lang="ts">
import BottomNavigation from '@/components/BottomNavigation.vue'
import type { NavigationItem } from '@/components/BottomNavigation.vue'

const navItems: NavigationItem[] = [
  {
    label: '首页',
    path: '/',
    icon: '🏠',
    activeIcon: '🏠',
  },
  {
    label: '女优',
    path: '/actors',
    icon: '👤',
    activeIcon: '👤',
  },
  {
    label: '我的',
    path: '/profile',
    icon: '👨',
    activeIcon: '👨',
  },
]
</script>

<template>
  <BottomNavigation :items="navItems" />
</template>
```

## API

### Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `items` | `NavigationItem[]` | `[]` | 导航项列表 |

### NavigationItem 接口

```typescript
interface NavigationItem {
  label: string           // 导航项文本
  path: string            // 路由路径
  icon?: string           // 默认图标（emoji 或 icon class）
  activeIcon?: string     // 激活时图标
  badge?: number          // 徽章数字
  badgeMax?: number       // 徽章最大显示数（默认 99）
}
```

### Events

| 事件名 | 参数 | 说明 |
|--------|------|------|
| `item-click` | `(item: NavigationItem, index: number)` | 导航项点击时触发 |

## 高级用法

### 带徽章的导航

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'

const downloadCount = ref(5)

const navItems = computed<NavigationItem[]>(() => [
  { label: '首页', path: '/', icon: '🏠' },
  { label: '女优', path: '/actors', icon: '👤' },
  {
    label: '我的',
    path: '/profile',
    icon: '👨',
    badge: downloadCount.value, // 动态徽章
    badgeMax: 99, // 超过 99 显示 99+
  },
])
</script>

<template>
  <BottomNavigation :items="navItems" />
</template>
```

### 动态图标

```vue
<script setup lang="ts">
const navItems: NavigationItem[] = [
  {
    label: '首页',
    path: '/',
    icon: '🏠',        // 默认图标
    activeIcon: '🏡',  // 激活时图标
  },
  {
    label: '收藏',
    path: '/favorites',
    icon: '☆',         // 空心星星
    activeIcon: '⭐',   // 实心星星
  },
]
</script>
```

### 监听导航点击

```vue
<script setup lang="ts">
function handleItemClick(item: NavigationItem, index: number) {
  console.log(`点击了第 ${index + 1} 个导航项: ${item.label}`)
  
  // 可以在这里执行额外逻辑
  // 例如埋点统计、预加载数据等
}
</script>

<template>
  <BottomNavigation
    :items="navItems"
    @item-click="handleItemClick"
  />
</template>
```

### 配合 useDrawer 使用

```vue
<script setup lang="ts">
import { useDrawer } from '@/composables/useDrawer'

const { isOpen, toggle } = useDrawer()

const navItems: NavigationItem[] = [
  { label: '首页', path: '/', icon: '🏠' },
  { label: '女优', path: '/actors', icon: '👤' },
  { label: '我的', path: '/profile', icon: '👨' },
]
</script>

<template>
  <!-- 汉堡菜单 -->
  <button @click="toggle">☰</button>

  <!-- 抽屉 -->
  <MobileDrawer v-model="isOpen">
    <!-- ... -->
  </MobileDrawer>

  <!-- 底部导航 -->
  <BottomNavigation :items="navItems" />
</template>
```

## Safe Area 适配

组件已内置 iPhone 底部安全区域适配：

```css
/* 组件内部实现 */
.bottom-navigation {
  padding-bottom: calc(1rem + env(safe-area-inset-bottom));
}
```

在不同设备上的表现：
- **iPhone X/11/12/13/14**: 自动增加底部安全区域高度
- **Android**: 正常显示，无额外间距
- **桌面浏览器**: 正常显示

## 响应式行为

```vue
<!-- 移动端显示（≤768px） -->
<BottomNavigation v-if="isMobile" :items="navItems" />

<!-- 或使用 CSS 控制 -->
<BottomNavigation class="md:hidden" :items="navItems" />
```

在 `App.vue` 中的完整示例：

```vue
<script setup lang="ts">
import { useMobileDetect } from './composables/useMobileDetect'

const { isMobile } = useMobileDetect()
</script>

<template>
  <div>
    <!-- 主内容区（底部留白） -->
    <main :class="{ 'pb-20': isMobile }">
      <RouterView />
    </main>

    <!-- 底部导航（仅移动端） -->
    <BottomNavigation v-if="isMobile" :items="navItems" />
  </div>
</template>
```

## 样式定制

### 修改主题色

```vue
<style>
.bottom-navigation a.router-link-active {
  color: #4ade80; /* 自定义高亮色 */
}

.bottom-navigation .badge {
  background-color: #ef4444; /* 自定义徽章色 */
}
</style>
```

### 调整高度

```vue
<style>
.bottom-navigation {
  height: 4rem; /* 默认 4rem (64px) */
}
</style>
```

## 样式类名

| 类名 | 说明 |
|------|------|
| `.bottom-navigation` | 导航栏容器 |
| `.nav-item` | 导航项 |
| `.nav-icon` | 图标容器 |
| `.nav-label` | 文本标签 |
| `.badge` | 徽章容器 |
| `.router-link-active` | 激活路由类名 |

## 性能优化

1. **避免频繁更新徽章**：
```typescript
// 使用 computed 缓存
const navItems = computed(() => [
  // ...
  { label: '我的', path: '/profile', badge: downloadCount.value },
])
```

2. **懒加载路由**：
```typescript
const routes = [
  { path: '/profile', component: () => import('./views/Profile.vue') },
]
```

3. **减少重渲染**：使用 `v-memo` 优化（Vue 3.2+）
```vue
<div v-for="item in items" v-memo="[item.badge, $route.path]">
  <!-- ... -->
</div>
```

## 无障碍最佳实践

```vue
<template>
  <BottomNavigation :items="navItems">
    <template #item="{ item }">
      <RouterLink
        :to="item.path"
        :aria-label="`导航到${item.label}`"
        :aria-current="isActive(item.path) ? 'page' : undefined"
      >
        {{ item.icon }} {{ item.label }}
      </RouterLink>
    </template>
  </BottomNavigation>
</template>
```

## 单元测试覆盖

组件包含 13 个单元测试：

- ✅ 导航项渲染
- ✅ 路由高亮
- ✅ 徽章显示
- ✅ 点击事件
- ✅ Safe Area 适配
- ✅ 响应式行为

## 常见问题

### 问题：底部导航遮挡内容

**解决**：为主内容区添加底部 padding

```vue
<main class="pb-20">
  <RouterView />
</main>
```

### 问题：徽章数字不更新

**原因**：`items` 没有响应式更新

**解决**：使用 `ref` 或 `computed`
```typescript
const navItems = computed(() => [...])
```

### 问题：在桌面端仍显示

**解决**：使用 `v-if` 控制显示
```vue
<BottomNavigation v-if="isMobile" :items="navItems" />
```

## 设计规范

- **高度**：64px (4rem)
- **最大导航项**：3-5 个（推荐 3-4 个）
- **图标尺寸**：24x24px
- **文字大小**：12px (0.75rem)
- **Safe Area**：自动适配，无需手动计算

## 最佳实践

1. **导航项数量**：不超过 5 个，推荐 3-4 个
2. **图标选择**：使用清晰易识别的图标
3. **标签文本**：简短（2-4 个字符）
4. **徽章使用**：仅用于重要提示，避免滥用
5. **路由设计**：确保导航项对应的路由存在

## 相关组件

- [MobileDrawer](./MobileDrawer.md) - 抽屉菜单
- [Select](./Select.md) - 自定义下拉选择器
- [useMobileDetect](../composables/useMobileDetect.md) - 移动端检测

---

**版本**：1.0.0  
**作者**：Starye Team  
**最后更新**：2026-03-31
