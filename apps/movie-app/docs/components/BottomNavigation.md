# BottomNavigation

源码：[BottomNavigation.vue](../../src/components/BottomNavigation.vue)

## Props

| 属性 | 类型 | 说明 |
|------|------|------|
| items | NavItem[] | 导航项列表 |

NavItem 只有 path、icon、label 和可选 badge。组件使用 RouterLink，根据当前路由高亮，并在移动端固定显示；它没有自定义事件、activeIcon 或 badgeMax。

~~~vue
<BottomNavigation :items="[
  { path: '/', icon: 'home', label: '首页' },
  { path: '/actors', icon: 'user', label: '女优', badge: 2 },
]" />
~~~

组件测试：[BottomNavigation.test.ts](../../src/components/__tests__/BottomNavigation.test.ts)
