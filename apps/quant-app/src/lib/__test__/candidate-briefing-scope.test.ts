import { describe, expect, it } from 'vitest'
import { buildCandidateBriefingScopeKey, canApplyCandidateBriefingResponse } from '../candidate-briefing-scope'

describe('candidate AI briefing scope', () => {
  it('uses a normalized order-independent key for the visible codes', () => {
    expect(buildCandidateBriefingScopeKey(['000001.sz', '601899.SH', '000001.SZ'])).toBe('000001.SZ|601899.SH')
  })

  it('rejects responses from an old request or old visible scope', () => {
    expect(canApplyCandidateBriefingResponse(3, 3, 'A|B', 'A|B')).toBe(true)
    expect(canApplyCandidateBriefingResponse(2, 3, 'A|B', 'A|B')).toBe(false)
    expect(canApplyCandidateBriefingResponse(3, 3, 'A|B', 'A|C')).toBe(false)
  })

  it('keeps the current response only when both request identity and scope match', () => {
    const scope = buildCandidateBriefingScopeKey(['000001.SZ', '601899.SH'])
    expect(canApplyCandidateBriefingResponse(4, 4, scope, buildCandidateBriefingScopeKey(['601899.SH', '000001.SZ']))).toBe(true)
    expect(canApplyCandidateBriefingResponse(4, 5, scope, scope)).toBe(false)
  })
})
