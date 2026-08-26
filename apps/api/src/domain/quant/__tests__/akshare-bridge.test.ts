import type { QuantResearchReport } from '../research-report'
import { describe, expect, it, vi } from 'vitest'
import { createQuantAkshareBridge, QuantAkshareBridgeError } from '../akshare-bridge'

const reportEvidence: QuantResearchReport = {
  reportVersion: 'research-report-v2',
  tsCode: '601899.SH',
  name: '紫金矿业',
  generatedAt: '2026-08-26T00:00:00.000Z',
  sourceSnapshotId: null,
  status: 'partial',
  action: 'wait-confirmation',
  score: 70,
  headline: '等待确认',
  strengths: [],
  risks: [],
  gaps: [],
  nextActions: [],
  evidence: [{
    key: 'trend-sample',
    dimension: 'trend',
    label: '日线样本',
    status: 'pass',
    value: 80,
    threshold: '至少 60 根',
    source: '本地',
    observedAt: '20260825',
    formulaVersion: 'v1',
    detail: 'ok',
  }],
  sources: [],
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: 'quant-akshare-v1',
    provider: 'akshare',
    request_id: 'request-1',
    ts_code: '601899.SH',
    observed_at: '2026-08-26T00:00:00.000Z',
    status: 'ready',
    source: { adapter: 'akshare-adapter-v1', endpoints: ['stock_zh_a_hist'], formula_version: 'akshare-adapter-v1' },
    identity: { name: '紫金矿业' },
    daily_bars: [],
    financials: [],
    evidence: [{
      key: 'akshare-daily-sample',
      dimension: 'trend',
      label: 'AkShare 日线样本',
      status: 'pass',
      value: 120,
      threshold: '至少 60 根有效日线',
      source: 'AkShare stock_zh_a_hist',
      observed_at: '20260825',
      formula_version: 'akshare-adapter-v1',
      detail: 'ok',
    }],
    errors: [],
    ...overrides,
  }
}

describe('akShare bridge client', () => {
  it('fails closed when the bridge is not configured', async () => {
    const client = createQuantAkshareBridge()
    expect(client.isConfigured).toBe(false)
    await expect(client.fetchEvidence({ tsCode: '601899.SH' })).rejects.toMatchObject({ code: 'CONFIGURATION', status: 503 })
  })

  it('validates and normalizes the versioned bridge response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload()), { status: 200 }))
    const client = createQuantAkshareBridge({ baseUrl: 'https://bridge.example.test/', token: 'secret-token', fetchImpl })
    const result = await client.fetchEvidence({ tsCode: '601899.SH' })
    expect(result).toMatchObject({ schemaVersion: 'quant-akshare-v1', tsCode: '601899.SH', status: 'ready' })
    expect(result.source).toMatchObject({ id: 'akshare-bridge', formulaVersion: 'akshare-adapter-v1' })
    expect(result.evidence[0]).toMatchObject({ key: 'akshare-daily-sample', value: 120 })
    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe('https://bridge.example.test/v1/evidence')
    expect(fetchImpl).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      headers: expect.objectContaining({ authorization: 'Bearer secret-token' }),
    }))
  })

  it('rejects a mismatched stock code or malformed evidence', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload({ ts_code: '600089.SH' })), { status: 200 }))
    const client = createQuantAkshareBridge({ baseUrl: 'https://bridge.example.test', token: 'secret-token', fetchImpl })
    await expect(client.fetchEvidence({ tsCode: '601899.SH' })).rejects.toBeInstanceOf(QuantAkshareBridgeError)
  })

  it('keeps the report evidence type available to callers without sending it to the bridge', () => {
    expect(reportEvidence.evidence[0]?.key).toBe('trend-sample')
  })
})
