import type { AppEnv } from '../../types'
import { Hono } from 'hono'
import { describeRoute, resolver, validator } from 'hono-openapi'
import { ActorDetailSchema, ActorsListDataSchema, GetActorParamSchema, GetActorsQuerySchema } from '../../schemas/actor'
import { ErrorResponseSchema, SuccessResponseSchema } from '../../schemas/responses'
import { getActorDetail, getActorList } from './handlers/actors.handler'

/**
 * Actors 路由 - 使用链式调用以支持 RPC 类型推导
 */
export const actorsRoutes = new Hono<AppEnv>()
  .get(
    '/',
    describeRoute({
      summary: '获取演员列表',
      description: '支持分页、排序、国籍筛选等',
      tags: ['Actors'],
      operationId: 'getActorsList',
      responses: {
        200: {
          description: '成功返回演员列表',
          content: {
            'application/json': {
              schema: resolver(SuccessResponseSchema(ActorsListDataSchema, '成功返回演员列表')),
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
    validator('query', GetActorsQuerySchema),
    getActorList,
  )
  .get(
    '/:slug',
    describeRoute({
      summary: '获取演员详情',
      description: '根据 slug 获取演员的完整信息',
      tags: ['Actors'],
      operationId: 'getActorDetail',
      responses: {
        200: {
          description: '成功返回演员详情',
          content: {
            'application/json': {
              schema: resolver(SuccessResponseSchema(ActorDetailSchema, '成功返回演员详情')),
            },
          },
        },
        404: {
          description: '演员不存在',
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
    validator('param', GetActorParamSchema),
    getActorDetail,
  )
