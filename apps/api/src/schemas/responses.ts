import * as v from 'valibot'

/**
 * 成功响应 Schema（泛型）
 * 用于包装所有成功的 API 响应
 */
export function SuccessResponseSchema<T extends v.GenericSchema>(
  dataSchema: T,
  description: string = '请求成功',
) {
  return v.pipe(
    v.object({
      success: v.literal(true),
      data: dataSchema,
    }),
    v.description(description),
  )
}

/**
 * 错误响应 Schema
 * 用于所有失败的 API 响应
 */
export const ErrorResponseSchema = v.pipe(
  v.object({
    success: v.literal(false),
    error: v.object({
      code: v.pipe(
        v.string(),
        v.examples(['VALIDATION_ERROR', 'NOT_FOUND', 'UNAUTHORIZED', 'INTERNAL_ERROR']),
        v.description('错误代码'),
      ),
      message: v.pipe(
        v.string(),
        v.examples(['参数验证失败', '资源不存在', '未授权访问', '服务器内部错误']),
        v.description('错误描述'),
      ),
    }),
  }),
  v.examples([
    {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: '资源不存在',
      },
    },
  ]),
  v.metadata({ ref: 'ErrorResponse' }),
)

export type ErrorResponse = v.InferOutput<typeof ErrorResponseSchema>

/**
 * 分页列表响应 Schema（泛型）
 * 用于包装分页列表的 API 响应
 */
export function PaginatedResponseSchema<T extends v.GenericSchema>(
  itemSchema: T,
  description: string = '分页列表响应',
) {
  return v.pipe(
    v.object({
      success: v.literal(true),
      data: v.object({
        items: v.array(itemSchema),
        pagination: v.object({
          current: v.pipe(v.number(), v.integer(), v.minValue(1)),
          total: v.pipe(v.number(), v.integer(), v.minValue(0)),
          hasNext: v.boolean(),
        }),
      }),
    }),
    v.description(description),
  )
}

/**
 * 简单消息响应 Schema
 * 用于只需返回消息的场景（如删除成功）
 */
export const MessageResponseSchema = v.pipe(
  v.object({
    success: v.literal(true),
    message: v.pipe(
      v.string(),
      v.examples(['操作成功', '删除成功', '更新成功']),
    ),
  }),
  v.metadata({ ref: 'MessageResponse' }),
)

export type MessageResponse = v.InferOutput<typeof MessageResponseSchema>
