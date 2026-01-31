import { createRouter, createWebHistory } from 'vue-router'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import { authClient } from '@/lib/auth-client'
import Comics from '@/views/Comics.vue'
import Home from '@/views/Home.vue'
import Login from '@/views/Login.vue'
import PostEditor from '@/views/PostEditor.vue'
import Posts from '@/views/Posts.vue'
import Settings from '@/views/Settings.vue'
import Users from '@/views/Users.vue'

const routes = [
  {
    path: '/login',
    component: Login,
    meta: { public: true },
  },
  {
    path: '/',
    component: DefaultLayout,
    children: [
      { path: '', component: Home },
      { path: 'comics', component: Comics },
      { path: 'posts', component: Posts },
      { path: 'posts/:id', component: PostEditor },
      { path: 'users', component: Users },
      { path: 'settings', component: Settings },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

interface UserWithRole {
  role: string
}

router.beforeEach(async (to, _from, next) => {
  if (to.meta.public)
    return next()

  const { data: session } = await authClient.getSession()

  // eslint-disable-next-line no-console
  console.log('[Auth Guard] Session:', session)

  if (!session) {
    window.location.href = `/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`
    return
  }

  // RBAC Check
  const role = (session.user as unknown as UserWithRole).role
  // eslint-disable-next-line no-console
  console.log('[Auth Guard] User Role:', role)

  const allowedRoles = ['super_admin', 'admin', 'comic_admin', 'movie_admin']
  if (!allowedRoles.includes(role)) {
    window.location.href = `/auth/login?error=insufficient_permissions&redirect=${encodeURIComponent(window.location.pathname)}`
    return
  }

  next()
})

export default router
