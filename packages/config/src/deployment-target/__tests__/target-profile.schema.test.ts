import { describe, expect, it } from 'vitest'

import {
  parseTargetProfile,
  requiredTargetUrlSurfaces,
} from '../target-profile.schema'
import { trackedTargetProfiles } from '../target-profiles'

describe('targetProfile schema', () => {
  const profile = trackedTargetProfiles[0]

  it('接受具有完整明确 canonical URL surface 的当前目标', () => {
    const parsed = parseTargetProfile(profile)

    expect(parsed.id).toBe('starye-org')
    expect(Object.keys(parsed.urls).sort()).toEqual([...requiredTargetUrlSurfaces].sort())
    expect(parsed.urls).toEqual({
      gateway: 'https://starye.org',
      api: 'https://api.starye.org',
      dashboard: 'https://dashboard.starye.org',
      auth: 'https://starye-auth.pages.dev',
      blog: 'https://blog.starye.org',
      movie: 'https://starye-movie.pages.dev',
      comic: 'https://starye-comic.pages.dev',
      tavern: 'https://starye-tavern.pages.dev',
    })
  })

  it('要求每个 URL surface、资源身份和 secret metadata', () => {
    const missingUrlSurface = {
      ...profile,
      urls: {
        ...profile.urls,
        tavern: undefined,
      },
    }
    const missingResourceIdentity = {
      ...profile,
      resources: {
        ...profile.resources,
        d1: {
          ...profile.resources.d1,
          id: '',
        },
      },
    }
    const missingRequiredSecretMetadata = {
      ...profile,
      requiredSecrets: [],
    }

    expect(() => parseTargetProfile(missingUrlSurface)).toThrow('Target profile is invalid')
    expect(() => parseTargetProfile(missingResourceIdentity)).toThrow('Target profile is invalid')
    expect(() => parseTargetProfile(missingRequiredSecretMetadata)).toThrow('Target profile is invalid')
  })

  it('拒绝任何 secret value 字段', () => {
    const profileWithSecretValue = {
      ...profile,
      requiredSecrets: [
        ...profile.requiredSecrets,
        {
          name: 'BETTER_AUTH_SECRET',
          required: true,
          consumers: ['api'],
          localFiles: ['apps/api/.dev.vars'],
          ciEnvironment: 'starye-org',
          value: 'must-never-be-tracked',
        },
      ],
    }

    expect(() => parseTargetProfile(profileWithSecretValue)).toThrow('Target profile is invalid')
  })

  it('声明当前 Cloudflare 资源与本地/CI 身份映射', () => {
    const parsed = parseTargetProfile(profile)

    expect(parsed.resources.d1).toMatchObject({
      binding: 'DB',
      name: 'starye-db',
    })
    expect(parsed.resources.r2).toMatchObject({
      binding: 'BUCKET',
      name: 'starye-media',
    })
    expect(parsed.resources.kv).toMatchObject({
      binding: 'CACHE',
    })
    expect(parsed.workers.api.name).toBe('starye-api')
    expect(parsed.workers.gateway.name).toBe('starye-gateway')
    expect(parsed.pages.dashboard.project).toBe('starye-dashboard')
    expect(parsed.pages.blog.project).toBe('blog-pages')
    expect(parsed.local.wranglerProfile).toBe('starye-org')
    expect(parsed.ci.githubEnvironment).toBe('starye-org')
  })
})
