import { createRouter, createWebHistory } from 'vue-router'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import { authClient } from '@/lib/auth-client'
import ActorDetail from '@/views/ActorDetail.vue'
import Actors from '@/views/Actors.vue'
import AuditLogs from '@/views/AuditLogs.vue'
import Comics from '@/views/Comics.vue'
import Crawlers from '@/views/Crawlers.vue'
import Favorites from '@/views/Favorites.vue'
import Home from '@/views/Home.vue'
import Login from '@/views/Login.vue'
import Movies from '@/views/Movies.vue'
import PostEditor from '@/views/PostEditor.vue'
import Posts from '@/views/Posts.vue'
import PublisherDetail from '@/views/PublisherDetail.vue'
import Publishers from '@/views/Publishers.vue'
import R18Whitelist from '@/views/R18Whitelist.vue'
import Settings from '@/views/Settings.vue'
import Unauthorized from '@/views/Unauthorized.vue'
import Users from '@/views/Users.vue'

const routes = [
  {
    path: '/login',
    component: Login,
    meta: { public: true },
  },
  {
    path: '/unauthorized',
    component: Unauthorized,
    meta: { public: true },
  },
  {
    path: '/',
    component: DefaultLayout,
    children: [
      {
        path: '',
        component: Home,
      },
      {
        path: 'comics',
        component: Comics,
        meta: { requiredRoles: ['admin', 'super_admin', 'comic_admin'] },
      },
      {
        path: 'movies',
        component: Movies,
        meta: { requiredRoles: ['admin', 'super_admin', 'movie_admin'] },
      },
      {
        path: 'crawlers',
        component: Crawlers,
        meta: { requiredRoles: ['admin', 'super_admin', 'comic_admin', 'movie_admin'] },
      },
      {
        path: 'actors',
        component: Actors,
        meta: { requiredRoles: ['admin', 'super_admin', 'movie_admin'] },
      },
      {
        path: 'actors/:id',
        component: ActorDetail,
        meta: { requiredRoles: ['admin', 'super_admin', 'movie_admin'] },
      },
      {
        path: 'publishers',
        component: Publishers,
        meta: { requiredRoles: ['admin', 'super_admin', 'movie_admin'] },
      },
      {
        path: 'publishers/:id',
        component: PublisherDetail,
        meta: { requiredRoles: ['admin', 'super_admin', 'movie_admin'] },
      },
      {
        path: 'audit-logs',
        component: AuditLogs,
        meta: { requiredRoles: ['admin', 'super_admin'] },
      },
      {
        path: 'r18-whitelist',
        component: R18Whitelist,
        meta: { requiredRoles: ['admin', 'super_admin'] },
      },
      {
        path: 'posts',
        component: Posts,
        meta: { requiredRoles: ['admin', 'super_admin'] },
      },
      {
        path: 'posts/:id',
        component: PostEditor,
        meta: { requiredRoles: ['admin', 'super_admin'] },
      },
      {
        path: 'users',
        component: Users,
        meta: { requiredRoles: ['admin', 'super_admin'] },
      },
      {
        path: 'settings',
        component: Settings,
      },
      {
        path: 'favorites',
        component: Favorites,
      },
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

  // Resource-level permission check
  const requiredRoles = to.meta.requiredRoles as string[] | undefined

  if (requiredRoles && requiredRoles.length > 0) {
    if (!requiredRoles.includes(role)) {
      console.warn('[Auth Guard] ❌ Insufficient permissions', {
        required: requiredRoles,
        actual: role,
        path: to.path,
      })
      return next('/unauthorized')
    }
  }

  next()
})

export default router
