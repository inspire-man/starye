import { describe, expect, it } from 'vitest'

import { parseTargetProfile } from '../target-profile.schema'
import {
  listTargetProfiles,
  resolveTargetProfile,
  TargetResolutionError,
} from '../target-resolver'

describe('resolveTargetProfile', () => {
  it.each([undefined, '', '   '])('将 %j 归类为缺少 selected target', (targetId) => {
    try {
      resolveTargetProfile(targetId)
      throw new Error('Expected target resolution to fail')
    }
    catch (error) {
      expect(error).toBeInstanceOf(TargetResolutionError)
      expect(error).toMatchObject({
        code: 'missing-selected-target',
        message: 'Missing selected target. Pass --target <id>.',
      })
    }
  })

  it.each(['production', 'prod', 'default', 'starye.org'])('拒绝 legacy alias %s', (targetId) => {
    expect(() => resolveTargetProfile(targetId)).toThrowError(
      `Unknown target profile: ${targetId}`,
    )
  })

  it('仅解析显式存在的 target id，并返回已验证的 profile', () => {
    const resolution = resolveTargetProfile(' starye-org ')

    expect(resolution.id).toBe('starye-org')
    expect(resolution.profile).toEqual(parseTargetProfile(resolution.profile))
    expect(listTargetProfiles()).toEqual(['starye-org'])
  })
})
