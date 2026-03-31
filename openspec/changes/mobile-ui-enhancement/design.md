# 移动端 UI 优化 - 技术设计

## 架构概览

```
移动端 UI 架构
┌─────────────────────────────────────────────────────┐
│                   Movie-App                         │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │ Header (fixed top, z-index: 50)             │  │
│  │ - Logo                                       │  │
│  │ - 汉堡菜单 (≤768px)                          │  │
│  │ - 搜索按钮 (右侧)                            │  │
│  │ - 用户头像                                   │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │ 主内容区 (滚动区域, z-index: 1)             │  │
│  │ - RouterView                                 │  │
│  │ - padding-bottom: calc(64px + safe-area)    │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │ BottomNavigation (fixed, z-index: 40)       │  │
│  │ - 🏠 首页 | 👥 女优 | 👤 我的               │  │
│  │ - padding-bottom: safe-area-inset-bottom    │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  ┌───────────────┐                                 │
│  │ MobileDrawer  │  (z-index: 2000)                │
│  │ (左侧滑出)     │  + Overlay (z-index: 1999)      │
│  │ width: 80vw   │                                 │
│  │ max: 320px    │                                 │
│  └───────────────┘                                 │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## 1. 自定义下拉组件 (Select)

### 组件 API

```typescript
// components/Select.vue
interface SelectOption<T = any> {
  label: string                    // 显示文本
  value: T                         // 值
  disabled?: boolean               // 是否禁用
  icon?: string                    // 图标（emoji 或 SVG）
  description?: string             // 描述文字
}

interface SelectProps<T = any> {
  // 核心
  modelValue: T
  options: SelectOption<T>[]
  
  // 外观
  placeholder?: string
  size?: 'small' | 'default' | 'large'
  disabled?: boolean
  
  // 行为
  clearable?: boolean              // 是否可清空
  teleportTo?: string              // Teleport 目标（默认 'body'）
  
  // 弹出层
  placement?: 'top' | 'bottom'
  popperClass?: string
  
  // 状态
  loading?: boolean
  error?: boolean
}

interface SelectEmits {
  'update:modelValue': (value: any) => void
  'change': (value: any) => void
  'visible-change': (visible: boolean) => void
  'clear': () => void
}
```

### 实现细节

**位置计算**：使用 Floating UI 或自定义位置计算
```typescript
function calculatePosition() {
  const rect = selectRef.value?.getBoundingClientRect()
  if (!rect) return
  
  return {
    top: rect.bottom + 4,
    left: rect.left,
    width: rect.width
  }
}
```

**点击外部关闭**：
```typescript
function handleClickOutside(event: MouseEvent) {
  if (!selectRef.value?.contains(event.target as Node) &&
      !dropdownRef.value?.contains(event.target as Node)) {
    visible.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
```

**动画**：
```scss
.select-dropdown-enter-active,
.select-dropdown-leave-active {
  transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1),
              transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.select-dropdown-enter-from {
  opacity: 0;
  transform: scaleY(0.9) translateY(-4px);
}

.select-dropdown-leave-to {
  opacity: 0;
  transform: scaleY(0.9) translateY(4px);
}
```

## 2. 移动端抽屉组件 (MobileDrawer)

### 组件 API

```typescript
// components/MobileDrawer.vue
interface DrawerProps {
  // 核心（参考 Element Plus）
  modelValue: boolean              // v-model 控制显隐
  direction: 'ltr'                 // 从左侧滑出（固定）
  size: string                     // 默认 '80vw' 最大 '320px'
  
  // 遮罩层
  modal: boolean                   // 是否显示遮罩，默认 true
  modalClass: string               // 遮罩自定义类
  closeOnClickModal: boolean       // 点击遮罩关闭，默认 true
  
  // 交互
  closeOnPressEscape: boolean      // ESC 关闭，默认 true
  lockScroll: boolean              // 锁定背景滚动，默认 true
  beforeClose?: (done: () => void) => void
  
  // 视觉
  showClose: boolean               // 显示关闭按钮，默认 true
  withHeader: boolean              // 显示头部，默认 true
  title: string                    // 抽屉标题
  zIndex: number                   // 层级，默认 2000
  
  // 生命周期
  onOpen?: () => void
  onOpened?: () => void
  onClose?: () => void
  onClosed?: () => void
}
```

### 插槽设计

```vue
<MobileDrawer v-model="isOpen">
  <!-- 头部插槽 -->
  <template #header>
    <div class="flex items-center gap-2">
      <span class="text-xl">菜单</span>
    </div>
  </template>

  <!-- 默认内容插槽 -->
  <template #default>
    <nav>...</nav>
  </template>

  <!-- 底部插槽 -->
  <template #footer>
    <DrawerFooter />
  </template>
</MobileDrawer>
```

### 实现细节

**背景滚动锁定**：
```typescript
watch(() => props.modelValue, (val) => {
  if (val && props.lockScroll) {
    document.body.style.overflow = 'hidden'
    document.body.style.paddingRight = `${getScrollbarWidth()}px`
  } else {
    document.body.style.overflow = ''
    document.body.style.paddingRight = ''
  }
})
```

**ESC 键关闭**：
```typescript
function handleEscape(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.closeOnPressEscape) {
    handleClose()
  }
}

onMounted(() => {
  if (props.closeOnPressEscape) {
    document.addEventListener('keydown', handleEscape)
  }
})
```

## 3. 底部导航组件 (BottomNavigation)

### 组件设计

```typescript
// components/BottomNavigation.vue
interface NavItem {
  path: string
  icon: string
  label: string
  badge?: number | string          // 徽章数字
}

const navItems: NavItem[] = [
  { path: '/', icon: '🏠', label: '首页' },
  { path: '/actors', icon: '👥', label: '女优' },
  { 
    path: '/profile', 
    icon: '👤', 
    label: '我的',
    badge: computed(() => downloadStats.total > 0 ? downloadStats.total : undefined)
  }
]
```

### 样式规范

```scss
.bottom-navigation {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 40;
  background: rgba(31, 41, 55, 0.95);
  backdrop-filter: blur(10px);
  border-top: 1px solid rgba(55, 65, 81, 0.5);
  padding-bottom: env(safe-area-inset-bottom);
  
  .nav-content {
    height: 64px;
    display: flex;
    justify-content: space-around;
    align-items: center;
  }
  
  .nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    flex: 1;
    padding: 8px;
    min-width: 60px;
    transition: all 0.2s;
    
    &.active {
      color: var(--color-primary);
      
      .nav-icon {
        transform: scale(1.1);
      }
    }
    
    &:active {
      transform: scale(0.95);
    }
  }
  
  .nav-icon {
    font-size: 24px;
    transition: transform 0.2s;
  }
  
  .nav-label {
    font-size: 12px;
    font-weight: 500;
  }
  
  .nav-badge {
    position: absolute;
    top: 4px;
    right: 8px;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    background: #ef4444;
    color: white;
    font-size: 11px;
    font-weight: 600;
    border-radius: 9px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}
```

## 4. 收藏夹功能

### 数据库 Schema

```typescript
// packages/db/src/schema/favorites.ts
export const favorites = sqliteTable('favorites', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  movieId: text('movie_id').notNull()
    .references(() => movies.id, { onDelete: 'cascade' }),
  movieCode: text('movie_code').notNull(),
  
  // 扩展字段
  tags: text('tags', { mode: 'json' }).$type<string[]>(),
  notes: text('notes'),
  rating: integer('rating'),  // 1-5 星
  
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull().$defaultFn(() => new Date()),
})

// 唯一索引
export const favoritesUniqueIndex = uniqueIndex('favorites_user_movie_unique')
  .on(favorites.userId, favorites.movieId)
```

### API 路由

```typescript
// apps/api/src/routes/favorites/index.ts
const app = new Hono()

// GET /api/favorites - 获取收藏列表
// POST /api/favorites - 添加收藏
// DELETE /api/favorites/:id - 删除收藏
// PATCH /api/favorites/:id - 更新收藏
// POST /api/favorites/batch-remove - 批量删除
// GET /api/favorites/check/:movieId - 检查是否已收藏
// GET /api/favorites/stats - 获取统计信息
```

### Composable

```typescript
// composables/useFavorites.ts
export function useFavorites() {
  const favorites = ref<Favorite[]>([])
  const stats = ref({ total: 0, recentAdded: 0 })
  
  const isFavorited = (movieId: string) => {
    return favorites.value.some(f => f.movieId === movieId)
  }
  
  const addFavorite = async (movie: Movie) => { /* ... */ }
  const removeFavorite = async (id: string) => { /* ... */ }
  const batchRemove = async (ids: string[]) => { /* ... */ }
  const updateFavorite = async (id: string, data: Partial<Favorite>) => { /* ... */ }
  
  return {
    favorites,
    stats,
    isFavorited,
    addFavorite,
    removeFavorite,
    batchRemove,
    updateFavorite
  }
}
```

## 5. 移动端检测与响应式

### Composable

```typescript
// composables/useMobileDetect.ts
export function useMobileDetect() {
  const isMobile = ref(false)
  const isTablet = ref(false)
  
  const checkDevice = () => {
    const width = window.innerWidth
    isMobile.value = width < 768
    isTablet.value = width >= 768 && width < 1024
  }
  
  onMounted(() => {
    checkDevice()
    window.addEventListener('resize', checkDevice)
  })
  
  onUnmounted(() => {
    window.removeEventListener('resize', checkDevice)
  })
  
  return {
    isMobile,
    isTablet,
    isDesktop: computed(() => !isMobile.value && !isTablet.value)
  }
}
```

### 响应式策略

```scss
// 断点定义
$breakpoint-mobile: 768px;
$breakpoint-tablet: 1024px;

@mixin mobile {
  @media (max-width: #{$breakpoint-mobile - 1px}) {
    @content;
  }
}

@mixin tablet {
  @media (min-width: $breakpoint-mobile) and (max-width: #{$breakpoint-tablet - 1px}) {
    @content;
  }
}

@mixin desktop {
  @media (min-width: $breakpoint-tablet) {
    @content;
  }
}
```

## 6. Safe Area 适配

### CSS 变量

```css
:root {
  --safe-area-inset-top: env(safe-area-inset-top);
  --safe-area-inset-right: env(safe-area-inset-right);
  --safe-area-inset-bottom: env(safe-area-inset-bottom);
  --safe-area-inset-left: env(safe-area-inset-left);
}
```

### 底部导航适配

```scss
.bottom-navigation {
  // 基础高度 + 安全区域
  padding-bottom: var(--safe-area-inset-bottom);
  
  // 为主内容预留空间
  & ~ .main-content {
    padding-bottom: calc(64px + var(--safe-area-inset-bottom));
  }
}
```

### Meta 配置

```html
<!-- index.html -->
<meta 
  name="viewport" 
  content="width=device-width, initial-scale=1.0, viewport-fit=cover"
>
```

## 7. 抽屉菜单结构

### 菜单项配置

```typescript
// 抽屉菜单配置
const drawerMenuItems = computed(() => [
  {
    section: '浏览',
    items: [
      { 
        path: '/publishers', 
        icon: '🏢', 
        label: '厂商列表',
        description: '按厂商浏览影片'
      }
    ]
  },
  {
    section: '我的',
    items: [
      { 
        path: '/favorites', 
        icon: '⭐', 
        label: '收藏夹',
        badge: favoritesStats.value.total
      }
    ]
  },
  {
    section: '其他',
    items: [
      { path: '/help', icon: '📖', label: '帮助' },
      { path: '/about', icon: 'ℹ️', label: '关于' }
    ]
  }
])
```

### DrawerFooter 组件

```vue
<!-- components/DrawerFooter.vue -->
<template>
  <div class="drawer-footer">
    <!-- R18 状态卡片 -->
    <div 
      class="r18-status-card"
      :class="userStore.user?.isR18Verified ? 'verified' : 'unverified'"
    >
      <div class="flex items-center gap-3">
        <span class="status-icon text-2xl">
          {{ userStore.user?.isR18Verified ? '🔞' : '🔒' }}
        </span>
        <div class="flex-1">
          <div class="status-title">
            {{ userStore.user?.isR18Verified ? 'R18 已验证' : 'SFW 模式' }}
          </div>
          <div class="status-desc text-xs">
            {{ userStore.user?.isR18Verified 
              ? '可访问完整内容' 
              : '部分内容已隐藏' 
            }}
          </div>
        </div>
      </div>
    </div>

    <!-- 用户信息 -->
    <div v-if="userStore.user" class="user-info-card">
      <div class="flex items-center gap-3">
        <img :src="userStore.user.image" class="w-10 h-10 rounded-full" />
        <div class="flex-1 min-w-0">
          <div class="username truncate">{{ userStore.user.name }}</div>
          <div class="user-email text-xs truncate">{{ userStore.user.email }}</div>
        </div>
      </div>
    </div>

    <!-- 登出按钮 -->
    <button class="logout-btn" @click="userStore.signOut">
      <span>🚪</span>
      <span>退出登录</span>
    </button>
  </div>
</template>
```

## 8. Profile Tab 下拉优化

### 实现方案

```vue
<!-- Profile.vue -->
<template>
  <div class="profile-container">
    <!-- 移动端：下拉选择器 -->
    <div v-if="isMobile" class="tab-selector">
      <Select 
        v-model="activeTab"
        :options="tabOptions"
        size="default"
      />
    </div>

    <!-- 桌面端：Tab 栏 -->
    <div v-else class="tabs">
      <button
        v-for="tab in tabOptions"
        :key="tab.value"
        :class="{ active: activeTab === tab.value }"
        @click="activeTab = tab.value"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Tab 内容 -->
    <div class="tab-content">
      <component :is="currentTabComponent" />
    </div>
  </div>
</template>

<script setup lang="ts">
const tabOptions = [
  { label: '📺 观看历史', value: 'history' },
  { label: '📥 我的下载', value: 'downloads' },
  { label: '⚙️ Aria2 设置', value: 'aria2-settings' },
  { label: '⬇️ 下载任务', value: 'aria2-tasks' },
  { label: '⭐ 我的评分', value: 'my-ratings' }
]
</script>
```

## 9. 性能优化

### 懒加载

```typescript
// 路由懒加载
const routes = [
  {
    path: '/favorites',
    component: () => import('./views/Favorites.vue')
  }
]

// 组件懒加载
const MobileDrawer = defineAsyncComponent(
  () => import('./components/MobileDrawer.vue')
)
```

### 防抖节流

```typescript
// 窗口 resize 事件防抖
const debouncedCheckDevice = useDebounceFn(checkDevice, 200)
window.addEventListener('resize', debouncedCheckDevice)
```

## 10. 测试策略

### 单元测试

- Select 组件的选项选择逻辑
- useFavorites composable 的状态管理
- useMobileDetect 的断点检测

### 集成测试

- 底部导航的路由跳转
- 抽屉菜单的开关状态
- 收藏夹的增删改查

### E2E 测试

- 移动端导航完整流程
- 收藏夹端到端操作
- 不同设备尺寸的适配

### 真机测试

- iPhone (不同尺寸) 的 Safe Area 适配
- Android 设备的兼容性
- 横竖屏切换测试

## 技术栈

- Vue 3 Composition API
- TypeScript
- Tailwind CSS
- Vite
- Drizzle ORM
- Hono (API 路由)
- VueUse (工具函数)
