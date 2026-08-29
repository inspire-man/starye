export function buildCandidateBriefingScopeKey(tsCodes: readonly string[]): string {
  return [...new Set(tsCodes.map(tsCode => tsCode.trim().toUpperCase()))].sort().join('|')
}

export function canApplyCandidateBriefingResponse(
  requestId: number,
  currentRequestId: number,
  requestScopeKey: string,
  currentScopeKey: string,
): boolean {
  return requestId === currentRequestId && requestScopeKey === currentScopeKey
}
