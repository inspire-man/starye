import type { AppEnv } from '../../types'
import { Hono } from 'hono'
import { describeRoute, resolver, validator } from 'hono-openapi'
import * as v from 'valibot'
import { requireAuth } from '../../middleware/guard'
import { AddFavoriteBodySchema, DeleteFavoriteParamSchema, FavoritesListDataSchema, GetFavoritesQuerySchema } from '../../schemas/favorite'
import { ErrorResponseSchema, SuccessResponseSchema } from '../../schemas/responses'
import { addFavoriteHandler, checkFavoriteHandler, deleteFavoriteHandler, getFavoriteList } from './handlers/favorite.handler'

/**
 * Favorites 路由
 */
export const favoritesRoutes = new Hono<AppEnv>()
  .use('*', requireAuth())
  .get(
    '/',
    describeRoute({
      summary: '获取收藏列表',
      description: `获取当前登录用户的收藏列表。

支持按实体类型筛选（电影、女优、厂商、漫画）和分页查询。

**示例场景**：
- 用户浏览个人收藏夹页面
- 筛选特定类型的收藏（如仅查看收藏的电影）
- 分页加载大量收藏数据

**注意事项**：
- 需要用户登录认证
- 最大每页 100 条记录
- 按创建时间倒序排列`,
      tags: ['Favorites'],
      operationId: 'getFavorites',
      responses: {
        200: {
          description: '成功返回收藏列表',
          content: {
            'application/json': {
              schema: resolver(SuccessResponseSchema(FavoritesListDataSchema, '成功返回收藏列表')),
              example: {
                success: true,
                data: {
                  data: [
                    {
                      id: 'fav_abc123',
                      userId: 'user_xyz789',
                      entityType: 'movie',
                      entityId: 'movie_001',
                      createdAt: 1711872000000,
                    },
                    {
                      id: 'fav_def456',
                      userId: 'user_xyz789',
                      entityType: 'actor',
                      entityId: 'actor_001',
                      createdAt: 1711858400000,
                    },
                  ],
                  pagination: {
                    page: 1,
                    limit: 24,
                    total: 42,
                    totalPages: 2,
                  },
                },
                message: '成功返回收藏列表',
              },
            },
          },
        },
        401: {
          description: '未认证 - 用户未登录或 token 无效',
          content: {
            'application/json': {
              schema: resolver(ErrorResponseSchema),
              example: {
                success: false,
                error: 'Authentication required',
              },
            },
          },
        },
        500: {
          description: '服务器内部错误',
          content: {
            'application/json': {
              schema: resolver(ErrorResponseSchema),
              example: {
                success: false,
                error: 'Internal server error',
              },
            },
          },
        },
      },
    }),
    validator('query', GetFavoritesQuerySchema),
    getFavoriteList,
  )
  .post(
    '/',
    describeRoute({
      summary: '添加收藏',
      description: `将指定实体添加到当前用户的收藏列表。

**幂等性**：如果实体已在收藏列表中，返回现有收藏 ID，不会重复创建。

**支持的实体类型**：
- \`movie\` - 电影
- \`actor\` - 女优
- \`publisher\` - 厂商
- \`comic\` - 漫画

**示例场景**：
- 用户在电影详情页点击"收藏"按钮
- 用户在女优页面添加关注
- 批量添加收藏（需多次调用）

**注意事项**：
- 需要用户登录
- 同一实体不会重复收藏
- \`alreadyExists\` 字段指示是否为已存在的收藏`,
      tags: ['Favorites'],
      operationId: 'addFavorite',
      responses: {
        200: {
          description: '成功添加收藏（包括已存在的情况）',
          content: {
            'application/json': {
              schema: resolver(SuccessResponseSchema(v.object({
                id: v.pipe(v.string(), v.description('收藏 ID')),
                alreadyExists: v.pipe(v.boolean(), v.description('是否已存在（true: 已存在，false: 新创建）')),
              }), '成功添加收藏')),
              examples: {
                newFavorite: {
                  summary: '新添加收藏',
                  value: {
                    success: true,
                    data: {
                      id: 'fav_new123',
                      alreadyExists: false,
                    },
                    message: '成功添加收藏',
                  },
                },
                existingFavorite: {
                  summary: '已在收藏夹中',
                  value: {
                    success: true,
                    data: {
                      id: 'fav_existing456',
                      alreadyExists: true,
                    },
                    message: '成功添加收藏',
                  },
                },
              },
            },
          },
        },
        400: {
          description: '请求参数错误',
          content: {
            'application/json': {
              schema: resolver(ErrorResponseSchema),
              example: {
                success: false,
                error: 'Invalid entity type',
              },
            },
          },
        },
        401: {
          description: '未认证 - 用户未登录',
          content: {
            'application/json': {
              schema: resolver(ErrorResponseSchema),
              example: {
                success: false,
                error: 'Authentication required',
              },
            },
          },
        },
        500: {
          description: '服务器内部错误',
          content: {
            'application/json': {
              schema: resolver(ErrorResponseSchema),
              example: {
                success: false,
                error: 'Failed to add favorite',
              },
            },
          },
        },
      },
    }),
    validator('json', AddFavoriteBodySchema),
    addFavoriteHandler,
  )
  .delete(
    '/:id',
    describeRoute({
      summary: '删除收藏',
      description: `从当前用户的收藏列表中移除指定项。

**权限验证**：
- 只能删除自己的收藏
- 尝试删除其他用户的收藏会返回 404

**示例场景**：
- 用户在收藏夹页面点击"取消收藏"
- 用户在详情页取消已收藏的内容
- 批量删除收藏（需多次调用）

**注意事项**：
- 需要用户登录
- 收藏 ID 不存在或无权访问时返回 404
- 删除成功后无法恢复`,
      tags: ['Favorites'],
      operationId: 'deleteFavorite',
      parameters: [
        {
          name: 'id',
          in: 'path',
          description: '收藏 ID（从收藏列表中获取）',
          required: true,
          schema: {
            type: 'string',
            example: 'fav_abc123',
          },
        },
      ],
      responses: {
        200: {
          description: '成功删除收藏',
          content: {
            'application/json': {
              schema: resolver(SuccessResponseSchema(v.object({
                success: v.boolean(),
              }), '成功删除收藏')),
              example: {
                success: true,
                data: {
                  success: true,
                },
                message: '成功删除收藏',
              },
            },
          },
        },
        401: {
          description: '未认证 - 用户未登录',
          content: {
            'application/json': {
              schema: resolver(ErrorResponseSchema),
              example: {
                success: false,
                error: 'Authentication required',
              },
            },
          },
        },
        404: {
          description: '收藏不存在或无权访问',
          content: {
            'application/json': {
              schema: resolver(ErrorResponseSchema),
              example: {
                success: false,
                error: 'Favorite not found',
              },
            },
          },
        },
        500: {
          description: '服务器内部错误',
          content: {
            'application/json': {
              schema: resolver(ErrorResponseSchema),
              example: {
                success: false,
                error: 'Failed to delete favorite',
              },
            },
          },
        },
      },
    }),
    validator('param', DeleteFavoriteParamSchema),
    deleteFavoriteHandler,
  )
  .get(
    '/check/:entityType/:entityId',
    describeRoute({
      summary: '检查是否已收藏',
      description: `检查指定实体是否已被当前用户收藏。

**使用场景**：
- 在详情页显示"已收藏"或"收藏"按钮状态
- 批量检查多个实体的收藏状态（需多次调用）
- 实时更新收藏按钮状态

**性能建议**：
- 对于列表页，建议在后端列表接口中直接返回收藏状态
- 使用前端缓存减少重复请求
- 考虑批量检查接口（如有大量实体需要检查）

**注意事项**：
- 需要用户登录
- 返回 \`isFavorited: true\` 表示已收藏
- 返回 \`isFavorited: false\` 表示未收藏`,
      tags: ['Favorites'],
      operationId: 'checkFavorite',
      parameters: [
        {
          name: 'entityType',
          in: 'path',
          description: '实体类型',
          required: true,
          schema: {
            type: 'string',
            enum: ['movie', 'actor', 'publisher', 'comic'],
            example: 'movie',
          },
        },
        {
          name: 'entityId',
          in: 'path',
          description: '实体 ID',
          required: true,
          schema: {
            type: 'string',
            example: 'movie_abc123',
          },
        },
      ],
      responses: {
        200: {
          description: '成功返回收藏状态',
          content: {
            'application/json': {
              schema: resolver(SuccessResponseSchema(v.object({
                isFavorited: v.pipe(v.boolean(), v.description('是否已收藏（true: 已收藏，false: 未收藏）')),
              }), '成功返回收藏状态')),
              examples: {
                favorited: {
                  summary: '已收藏',
                  value: {
                    success: true,
                    data: {
                      isFavorited: true,
                    },
                    message: '成功返回收藏状态',
                  },
                },
                notFavorited: {
                  summary: '未收藏',
                  value: {
                    success: true,
                    data: {
                      isFavorited: false,
                    },
                    message: '成功返回收藏状态',
                  },
                },
              },
            },
          },
        },
        401: {
          description: '未认证 - 用户未登录',
          content: {
            'application/json': {
              schema: resolver(ErrorResponseSchema),
              example: {
                success: false,
                error: 'Authentication required',
              },
            },
          },
        },
        500: {
          description: '服务器内部错误',
          content: {
            'application/json': {
              schema: resolver(ErrorResponseSchema),
              example: {
                success: false,
                error: 'Failed to check favorite status',
              },
            },
          },
        },
      },
    }),
    checkFavoriteHandler,
  )
