<script setup lang="ts">
import { useUserStore } from '../stores/user'

const userStore = useUserStore()
</script>

<template>
  <div class="drawer-footer">
    <!-- R18 状态卡片 -->
    <div
      v-if="userStore.user"
      class="r18-status-card"
      :class="userStore.user.isR18Verified ? 'verified' : 'unverified'"
    >
      <div class="flex items-center gap-3">
        <span class="status-icon text-2xl">
          {{ userStore.user.isR18Verified ? '🔞' : '🔒' }}
        </span>
        <div class="flex-1">
          <div class="status-title">
            {{ userStore.user.isR18Verified ? 'R18 已验证' : 'SFW 模式' }}
          </div>
          <div class="status-desc text-xs">
            {{ userStore.user.isR18Verified
              ? '可访问完整内容'
              : '部分内容已隐藏'
            }}
          </div>
        </div>
      </div>
    </div>

    <!-- 用户信息卡片 -->
    <div v-if="userStore.user" class="user-info-card">
      <div class="flex items-center gap-3">
        <img
          v-if="userStore.user.image"
          :src="userStore.user.image"
          :alt="userStore.user.name"
          class="w-10 h-10 rounded-full border-2 border-gray-600"
        >
        <div v-else class="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center text-white text-lg font-bold">
          {{ userStore.user.name[0].toUpperCase() }}
        </div>
        <div class="flex-1 min-w-0">
          <div class="username truncate">
            {{ userStore.user.name }}
          </div>
          <div class="user-email text-xs truncate">
            {{ userStore.user.email }}
          </div>
        </div>
      </div>
    </div>

    <!-- 登出按钮 -->
    <button
      v-if="userStore.user"
      class="logout-btn"
      @click="userStore.signOut"
    >
      <span class="text-lg">🚪</span>
      <span>退出登录</span>
    </button>

    <!-- 未登录提示 -->
    <button
      v-else
      class="login-btn"
      @click="userStore.signIn"
    >
      <span class="text-lg">🔑</span>
      <span>登录</span>
    </button>
  </div>
</template>

<style scoped>
.drawer-footer {
  padding: 16px;
  padding-bottom: calc(16px + env(safe-area-inset-bottom, 0));
  border-top: 1px solid rgb(55, 65, 81);
  background: rgb(24, 32, 43);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* R18 状态卡片 */
.r18-status-card {
  padding: 12px;
  border-radius: 8px;
  border: 1px solid;
  transition: all 0.2s;
}

.r18-status-card.verified {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.3);
}

.r18-status-card.unverified {
  background: rgba(251, 191, 36, 0.1);
  border-color: rgba(251, 191, 36, 0.3);
}

.status-icon {
  flex-shrink: 0;
  line-height: 1;
}

.status-title {
  font-size: 14px;
  font-weight: 600;
  color: white;
  margin-bottom: 2px;
}

.status-desc {
  font-size: 12px;
  color: rgb(156, 163, 175);
}

/* 用户信息卡片 */
.user-info-card {
  padding: 12px;
  border-radius: 8px;
  background: rgb(31, 41, 55);
  border: 1px solid rgb(55, 65, 81);
}

.username {
  font-size: 14px;
  font-weight: 600;
  color: white;
  margin-bottom: 2px;
}

.user-email {
  color: rgb(156, 163, 175);
}

/* 登出按钮 */
.logout-btn,
.login-btn {
  width: 100%;
  padding: 12px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid;
}

.logout-btn {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.3);
  color: rgb(248, 113, 113);
}

.logout-btn:hover {
  background: rgba(239, 68, 68, 0.2);
}

.logout-btn:active {
  transform: scale(0.98);
}

.login-btn {
  background: rgba(59, 130, 246, 0.1);
  border-color: rgba(59, 130, 246, 0.3);
  color: rgb(96, 165, 250);
}

.login-btn:hover {
  background: rgba(59, 130, 246, 0.2);
}

.login-btn:active {
  transform: scale(0.98);
}

/* Tailwind 工具类补充 */
.flex {
  display: flex;
}

.items-center {
  align-items: center;
}

.gap-3 {
  gap: 0.75rem;
}

.flex-1 {
  flex: 1;
}

.min-w-0 {
  min-width: 0;
}

.text-2xl {
  font-size: 1.5rem;
  line-height: 2rem;
}

.text-xs {
  font-size: 0.75rem;
  line-height: 1rem;
}

.text-lg {
  font-size: 1.125rem;
  line-height: 1.75rem;
}

.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.w-10 {
  width: 2.5rem;
}

.h-10 {
  height: 2.5rem;
}

.rounded-full {
  border-radius: 9999px;
}

.border-2 {
  border-width: 2px;
}

.border-gray-600 {
  border-color: rgb(75, 85, 99);
}

.bg-primary-600 {
  background-color: rgb(59, 130, 246);
}
</style>
