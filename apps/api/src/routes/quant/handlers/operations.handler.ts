import type { AppEnv } from '../../../types'
import { Hono } from 'hono'
import { validator } from 'hono-openapi'
import { QuantError } from '../../../domain/quant/errors'
import { createQuantOperation, deleteQuantOperation, readQuantOperationBoard } from '../../../domain/quant/operation-store'
import { QuantOperationCreateSchema, QuantOperationIdParamSchema } from '../../../schemas/quant'
import { quantRouteDocs } from '../contract-docs'
import { currentQuantUserId } from '../route-context'

export const quantOperationRoutes = new Hono<AppEnv>()

function tradedAt(value: string): Date {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime()))
    throw new QuantError('QUANT_INVALID_INPUT', 'traded_at is invalid', 400)
  return parsed
}

quantOperationRoutes.get('/operations', quantRouteDocs('workspace.operations.list'), async (c) => {
  const data = await readQuantOperationBoard(c.get('db'), currentQuantUserId(c))
  return c.json({ success: true as const, data })
})

quantOperationRoutes.post('/operations', quantRouteDocs('workspace.operations.create'), validator('json', QuantOperationCreateSchema), async (c) => {
  const input = c.req.valid('json')
  if (input.side === 'dividend' || input.side === 'pass' ? input.quantity !== 0 : input.quantity <= 0)
    throw new QuantError('QUANT_INVALID_INPUT', input.side === 'dividend' || input.side === 'pass' ? `${input.side} quantity must be 0` : 'quantity must be positive', 400)
  const operation = await createQuantOperation(c.get('db'), {
    userId: currentQuantUserId(c),
    tsCode: input.ts_code,
    name: input.name?.trim() ? input.name.trim() : null,
    side: input.side,
    price: input.price,
    quantity: input.side === 'dividend' || input.side === 'pass' ? 0 : input.quantity,
    fee: input.fee ?? 0,
    tradedAt: tradedAt(input.traded_at),
    note: input.note?.trim() ? input.note.trim() : null,
  })
  return c.json({ success: true as const, data: operation })
})

quantOperationRoutes.delete('/operations/:id', quantRouteDocs('workspace.operations.delete'), validator('param', QuantOperationIdParamSchema), async (c) => {
  const { id } = c.req.valid('param')
  await deleteQuantOperation(c.get('db'), currentQuantUserId(c), id)
  return c.json({ success: true as const, data: { id } })
})
