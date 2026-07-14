import { describe, expect, it } from 'vitest'

import {
  buildVitePublicRuntimeEnv,
  parseAuditedPublicRuntimeInput,
} from '../public-runtime-input'
import { resolveTargetProfile } from '../target-resolver'

describe('audited public runtime input', () => {
  it('applies only the documented public defaults when optional feature fields are omitted', () => {
    const input = parseAuditedPublicRuntimeInput(resolveTargetProfile('starye-org'), {
      buildMode: 'production',
    })

    expect(input.overlay).toMatchObject({
      monitoringEnabled: false,
      aria2Enabled: true,
      aria2WebsocketEnabled: true,
      ratingEnabled: true,
      autoScoreEnabled: true,
      performanceMonitoringEnabled: false,
    })
    expect(buildVitePublicRuntimeEnv(input, 'dashboard')).not.toHaveProperty('VITE_FEATURE_ARIA2')
  })

  it('does not allow a public overlay to replace selected target identity', () => {
    expect(() => parseAuditedPublicRuntimeInput(resolveTargetProfile('starye-org'), {
      buildMode: 'production',
      targetId: 'alternate-org',
    })).toThrow('Unknown public runtime overlay field')
  })
})
