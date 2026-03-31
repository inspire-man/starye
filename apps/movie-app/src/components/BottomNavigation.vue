<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'

// 导航项接口
export interface NavItem {
  path: string
  icon: string
  label: string
  badge?: number | string
}

// Props 定义
interface Props {
  items: NavItem[]
}

defineProps<Props>()
const route = useRoute()

// 判断是否激活
function isActive(path: string): boolean {
  if (path === '/') {
    return route.path === '/'
  }
  return route.path.startsWith(path)
}
</script>

<template>
  <nav class="bottom-navigation">
    <div class="nav-content">
      <RouterLink
        v-for="item in items"
        :key="item.path"
        :to="item.path"
        class="nav-item"
        :class="{ active: isActive(item.path) }"
      >
        <div class="nav-icon-wrapper">
          <span class="nav-icon">{{ item.icon }}</span>
          <span v-if="item.badge" class="nav-badge">
            {{ item.badge }}
          </span>
        </div>
        <span class="nav-label">{{ item.label }}</span>
      </RouterLink>
    </div>
  </nav>
</template>

<style scoped>
/* 底部导航容器 */
.bottom-navigation {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 40;
  background: rgba(31, 41, 55, 0.95);
  backdrop-filter: blur(10px);
  border-top: 1px solid rgba(55, 65, 81, 0.8);
  padding-bottom: env(safe-area-inset-bottom, 0);

  /* 阴影效果 */
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
}

/* 导航内容区域 */
.nav-content {
  height: 64px;
  display: flex;
  justify-content: space-around;
  align-items: center;
  max-width: 100%;
}

/* 导航项 */
.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  flex: 1;
  padding: 8px;
  min-width: 60px;
  text-decoration: none;
  color: rgb(156, 163, 175);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  border-radius: 8px;
  margin: 0 4px;
}

/* 激活状态 */
.nav-item.active {
  color: rgb(59, 130, 246);
}

.nav-item.active .nav-icon {
  transform: scale(1.1);
}

/* 点击效果 */
.nav-item:active {
  transform: scale(0.95);
  background: rgba(55, 65, 81, 0.5);
}

/* 图标容器 */
.nav-icon-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 图标 */
.nav-icon {
  font-size: 24px;
  line-height: 1;
  transition: transform 0.2s;
  display: block;
}

/* 标签 */
.nav-label {
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

/* 徽章 */
.nav-badge {
  position: absolute;
  top: -4px;
  right: -8px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  background: rgb(239, 68, 68);
  color: white;
  font-size: 11px;
  font-weight: 600;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  animation: badge-pulse 2s ease-in-out infinite;
}

@keyframes badge-pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

/* 响应式 */
@media (min-width: 768px) {
  .bottom-navigation {
    display: none;
  }
}

/* 主内容区域适配 */
:global(.main-content) {
  padding-bottom: calc(64px + env(safe-area-inset-bottom, 0));
}

@media (min-width: 768px) {
  :global(.main-content) {
    padding-bottom: 0;
  }
}
</style>
