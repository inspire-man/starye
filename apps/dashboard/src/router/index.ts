import { createRouter, createWebHistory } from 'vue-router'
import Home from '@/views/Home.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: Home,
    },
    {
      path: '/comics',
      name: 'comics',
      component: () => import('@/views/Comics.vue'),
    },
  ],
})

export default router
