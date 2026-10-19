import type { Database } from '@starye/db'
import type { QuantOperationFill } from './operation-ledger'
import { quantOperations } from '@starye/db/schema'
import { and, desc, eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { QuantError } from './errors'
import { buildQuantOperationLedger, researchContextFromReport } from './operation-ledger'
import { listQuantResearchRuns, normalizeTsCode } from './repository'

function iso(value: Date | number | string): string {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString()
}

function toFill(row: typeof quantOperations.$inferSelect): QuantOperationFill {
  return {
    id: row.id,
    tsCode: row.tsCode,
    name: row.name,
    side: row.side,
    price: row.price,
    quantity: row.quantity,
    fee: row.fee,
    tradedAt: iso(row.tradedAt),
    note: row.note,
    researchContext: row.researchContext ? researchContextFromReport(row.researchContext, null) : null,
  }
}

async function lookupResearchContext(db: Database, userId: string, tsCode: string): Promise<string | null> {
  try {
    const latest = (await listQuantResearchRuns(db, userId, tsCode, 1))[0]
    if (!latest)
      return null
    const generatedAt = latest.generatedAt instanceof Date ? latest.generatedAt.toISOString() : new Date(latest.generatedAt).toISOString()
    const context = researchContextFromReport(latest.reportJson, generatedAt)
    return context
      ? JSON.stringify({
          generatedAt: context.generatedAt,
          decision: {
            recommendation: context.recommendation,
            buyPriceRange: context.buyLow === null || context.buyHigh === null ? null : { low: context.buyLow, high: context.buyHigh },
            sellPriceRange: context.sellLow === null || context.sellHigh === null ? null : { low: context.sellLow, high: context.sellHigh },
          },
        })
      : null
  }
  catch {
    return null
  }
}

export async function listQuantOperationFills(db: Database, userId: string): Promise<QuantOperationFill[]> {
  const rows = await db.select().from(quantOperations).where(eq(quantOperations.userId, userId)).orderBy(desc(quantOperations.tradedAt), desc(quantOperations.id)).all()
  return rows.map(toFill)
}

export async function createQuantOperation(db: Database, input: {
  readonly userId: string
  readonly tsCode: string
  readonly name: string | null
  readonly side: 'buy' | 'sell' | 'dividend' | 'pass'
  readonly price: number
  readonly quantity: number
  readonly fee: number
  readonly tradedAt: Date
  readonly note: string | null
}): Promise<QuantOperationFill> {
  const id = nanoid()
  await db.insert(quantOperations).values({
    id,
    userId: input.userId,
    tsCode: normalizeTsCode(input.tsCode),
    name: input.name,
    side: input.side,
    price: input.price,
    quantity: input.quantity,
    fee: input.fee,
    tradedAt: input.tradedAt,
    note: input.note,
    researchContext: await lookupResearchContext(db, input.userId, input.tsCode),
    updatedAt: new Date(),
  })
  const persisted = await db.select().from(quantOperations).where(and(eq(quantOperations.id, id), eq(quantOperations.userId, input.userId))).get()
  if (!persisted)
    throw new QuantError('QUANT_INVALID_INPUT', 'Operation readback failed', 500)
  return toFill(persisted)
}

export async function deleteQuantOperation(db: Database, userId: string, id: string): Promise<void> {
  const existing = await db.select().from(quantOperations).where(and(eq(quantOperations.id, id), eq(quantOperations.userId, userId))).get()
  if (!existing)
    throw new QuantError('QUANT_NOT_FOUND', 'Operation was not found', 404)
  await db.delete(quantOperations).where(and(eq(quantOperations.id, id), eq(quantOperations.userId, userId)))
}

export async function readQuantOperationBoard(db: Database, userId: string) {
  const operations = await listQuantOperationFills(db, userId)
  return { operations, ledger: buildQuantOperationLedger(operations) }
}
