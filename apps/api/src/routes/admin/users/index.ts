import type { AppEnv } from '../../../types'
import { Hono } from 'hono'
import { describeRoute, validator } from 'hono-openapi'
import { serviceAuth } from '../../../middleware/service-auth'
import { UpdateUserRoleSchema, UpdateUserStatusSchema } from '../../../schemas/admin'
import { getUserList, updateUserRole, updateUserStatus } from './handlers'

export const adminUsersRoutes = new Hono<AppEnv>()

// 获取用户列表 (仅超级管理员)
adminUsersRoutes.get('/', serviceAuth(['admin']), getUserList)

// 提升/降级用户角色 (仅超级管理员)
adminUsersRoutes.patch(
  '/:email/role',
  describeRoute({
    summary: '更新用户角色',
    description: '提升或降级用户的角色权限',
    tags: ['Admin - Users'],
    operationId: 'updateUserRole',
    security: [{ serviceAuth: [] }],
    responses: {
      200: { description: '更新成功' },
    },
  }),
  serviceAuth(['admin']),
  validator('json', UpdateUserRoleSchema),
  updateUserRole,
)

// 修改用户状态 (允许 admin 和 comic_admin)
adminUsersRoutes.patch(
  '/:email/status',
  describeRoute({
    summary: '更新用户状态',
    description: '修改用户的状态（如成年标记）',
    tags: ['Admin - Users'],
    operationId: 'updateUserStatus',
    security: [{ serviceAuth: [] }],
    responses: {
      200: { description: '更新成功' },
    },
  }),
  serviceAuth(['admin', 'comic_admin']),
  validator('json', UpdateUserStatusSchema),
  updateUserStatus,
)
