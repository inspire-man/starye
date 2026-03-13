<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

function goBack() {
  router.back()
}
</script>

<template>
  <div class="unauthorized-page">
    <div class="content">
      <h1>🚫</h1>
      <h2>没有访问权限</h2>
      <p>您没有权限访问此页面</p>
      <p class="hint">
        请联系管理员获取相应权限
      </p>
      <button class="btn-back" @click="goBack">
        返回上一页
      </button>
    </div>
  </div>
</template>

<style scoped>
.unauthorized-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: #f9fafb;
}

.content {
  text-align: center;
  padding: 3rem;
  background: white;
  border-radius: 0.5rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  max-width: 500px;
}

.content h1 {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.content h2 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
  margin-bottom: 0.5rem;
}

.content p {
  color: #6b7280;
  margin-bottom: 0.5rem;
}

.hint {
  font-size: 0.875rem;
  margin-bottom: 2rem;
}

.btn-back {
  padding: 0.75rem 1.5rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
}

.btn-back:hover {
  background: #2563eb;
}
</style>
