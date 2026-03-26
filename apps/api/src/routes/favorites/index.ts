import type { AppEnv } from '../../types'
import { Hono } from 'hono'
import { describeRoute, resolver, validator } from 'hono-openapi'
import * as v from 'valibot'
import { requireAuth } from '../../middleware/guard'
import { AddFavoriteBodySchema, DeleteFavoriteParamSchema, FavoritesListDataSchema, GetFavoritesQuerySchema } from '../../schemas/favorite'
import { ErrorResponseSchema, SuccessResponseSchema } from '../../schemas/responses'
import { addFavoriteHandler, deleteFavoriteHandler, getFavoriteList } from './handlers/favorite.handler'

/**
 * Favorites 路由
 */
export const favoritesRoutes = new Hono<AppEnv>()
  .use('*', requireAuth())
  .get(
    '/',
    describeRoute({
      summary: '获取收藏列表',
      description: '获取当前用户的收藏列表，支持分页和按实体类型筛选',
      tags: ['Favorites'],
      operationId: 'getFavorites',
      responses: {
        200: {
          description: '成功返回收藏列表',
          content: {
            'application/json': {
              schema: resolver(SuccessResponseSchema(FavoritesListDataSchema, '成功返回收藏列表')),
            },
          },
        },
        401: {
          description: '未认证',
          content: {
            'application/json': {
              schema: resolver(ErrorResponseSchema),
            },
          },
        },
        500: {
          description: '服务器内部错误',
          content: {
            'application/json': {
              schema: resolver(ErrorResponseSchema),
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
      description: '添加一个实体到收藏列表',
      tags: ['Favorites'],
      operationId: 'addFavorite',
      responses: {
        200: {
          description: '成功添加收藏',
          content: {
            'application/json': {
              schema: resolver(SuccessResponseSchema(v.object({
                id: v.string(),
                alreadyExists: v.boolean(),
              }), '成功添加收藏')),
            },
          },
        },
        401: {
          description: '未认证',
          content: {
            'application/json': {
              schema: resolver(ErrorResponseSchema),
            },
          },
        },
        500: {
          description: '服务器内部错误',
          content: {
            'application/json': {
              schema: resolver(ErrorResponseSchema),
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
      description: '从收藏列表中删除指定项',
      tags: ['Favorites'],
      operationId: 'deleteFavorite',
      responses: {
        200: {
          description: '成功删除收藏',
          content: {
            'application/json': {
              schema: resolver(SuccessResponseSchema(v.object({
                success: v.boolean(),
              }), '成功删除收藏')),
            },
          },
        },
        401: {
          description: '未认证',
          content: {
            'application/json': {
              schema: resolver(ErrorResponseSchema),
            },
          },
        },
        404: {
          description: '收藏不存在或无权访问',
          content: {
            'application/json': {
              schema: resolver(ErrorResponseSchema),
            },
          },
        },
        500: {
          description: '服务器内部错误',
          content: {
            'application/json': {
              schema: resolver(ErrorResponseSchema),
            },
          },
        },
      },
    }),
    validator('param', DeleteFavoriteParamSchema),
    deleteFavoriteHandler,
  )
