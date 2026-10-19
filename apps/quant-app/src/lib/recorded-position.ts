import type { QuantOperationBoard } from '../api/resources/operations'

export interface QuantRecordedPosition {
  tsCode: string
  openQuantity: number
  averageCost: number | null
  realizedPnl: number
  closedCount: number
}

export function recordedPositionFromBoard(board: QuantOperationBoard, tsCode: string): QuantRecordedPosition | null {
  const stat = board.ledger.byCode.find(item => item.tsCode === tsCode)
  const lot = board.ledger.openLots.find(item => item.tsCode === tsCode)
  const openQuantity = lot?.quantity ?? stat?.openQuantity ?? 0
  const closedCount = stat?.closedCount ?? 0
  if (openQuantity <= 0 && closedCount <= 0)
    return null
  return {
    tsCode,
    openQuantity,
    averageCost: lot && lot.quantity > 0 ? lot.cost : null,
    realizedPnl: stat?.realizedPnl ?? 0,
    closedCount,
  }
}
