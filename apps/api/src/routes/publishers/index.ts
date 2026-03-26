import type { AppEnv } from '../../types'
import { Hono } from 'hono'
import { describeRoute, resolver, validator } from 'hono-openapi'
import { GetPublisherParamSchema, GetPublishersQuerySchema, PublisherDetailSchema, PublishersListDataSchema } from '../../schemas/publisher'
import { ErrorResponseSchema, SuccessResponseSchema } from '../../schemas/responses'
import { getPublisherDetail, getPublisherList } from './handlers/publishers.handler'

/**
 * Publishers 路由 - 使用链式调用以支持 RPC 类型推导
 */
export const publishersRoutes = new Hono<AppEnv>()
  .get(
    '/',
    describeRoute({
      summary: '获取出版商列表',
      description: '支持分页和排序',
      tags: ['Publishers'],
      operationId: 'getPublishersList',
      responses: {
        200: {
          description: '成功返回出版商列表',
          content: {
            'application/json': {
              schema: resolver(SuccessResponseSchema(PublishersListDataSchema, '成功返回出版商列表')),
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
    validator('query', GetPublishersQuerySchema),
    getPublisherList,
  )
  .get(
    '/:slug',
    describeRoute({
      summary: '获取出版商详情',
      description: '根据 slug 获取出版商的完整信息',
      tags: ['Publishers'],
      operationId: 'getPublisherDetail',
      responses: {
        200: {
          description: '成功返回出版商详情',
          content: {
            'application/json': {
              schema: resolver(SuccessResponseSchema(PublisherDetailSchema, '成功返回出版商详情')),
            },
          },
        },
        404: {
          description: '出版商不存在',
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
    validator('param', GetPublisherParamSchema),
    getPublisherDetail,
  )
