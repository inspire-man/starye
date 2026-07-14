import type { TargetProfile, TargetProfileId } from './target-profile.schema'

export const trackedTargetProfiles = [
  {
    id: 'starye-org',
    account: {
      id: '27c162f54c8f59fff74224775a59937e',
      name: 'starye-org',
    },
    domain: {
      root: 'starye.org',
      zoneName: 'starye.org',
    },
    local: {
      wranglerProfile: 'starye-org',
    },
    ci: {
      githubEnvironment: 'starye-org',
    },
    urls: {
      gateway: 'https://starye.org',
      api: 'https://api.starye.org',
      dashboard: 'https://dashboard.starye.org',
      auth: 'https://starye-auth.pages.dev',
      blog: 'https://blog.starye.org',
      movie: 'https://starye-movie.pages.dev',
      comic: 'https://starye-comic.pages.dev',
      tavern: 'https://starye-tavern.pages.dev',
    },
    workers: {
      api: {
        name: 'starye-api',
        routes: [
          {
            pattern: 'api.starye.org',
            customDomain: true,
          },
        ],
      },
      gateway: {
        name: 'starye-gateway',
        routes: [
          {
            pattern: 'starye.org',
            customDomain: true,
          },
          {
            pattern: 'www.starye.org',
            customDomain: true,
          },
        ],
      },
    },
    pages: {
      dashboard: {
        project: 'starye-dashboard',
        canonicalUrl: 'https://dashboard.starye.org',
      },
      auth: {
        project: 'starye-auth',
        canonicalUrl: 'https://starye-auth.pages.dev',
      },
      blog: {
        project: 'starye-blog',
        canonicalUrl: 'https://blog.starye.org',
      },
      movie: {
        project: 'starye-movie',
        canonicalUrl: 'https://starye-movie.pages.dev',
      },
      comic: {
        project: 'starye-comic',
        canonicalUrl: 'https://starye-comic.pages.dev',
      },
      tavern: {
        project: 'starye-tavern',
        canonicalUrl: 'https://starye-tavern.pages.dev',
      },
    },
    resources: {
      d1: {
        kind: 'd1',
        binding: 'DB',
        name: 'starye-db',
        id: '72b60b6c-806f-4795-a846-9b0d157b8225',
      },
      r2: {
        kind: 'r2',
        binding: 'BUCKET',
        name: 'starye-media',
      },
      kv: {
        kind: 'kv',
        binding: 'CACHE',
        id: 'f7f6a8c2bff84a1d89da528eab4eb559',
      },
    },
    requiredSecrets: [
      {
        name: 'CLOUDFLARE_API_TOKEN',
        required: true,
        consumers: ['ci'],
        localFiles: [],
        ciEnvironment: 'starye-org',
      },
      {
        name: 'BETTER_AUTH_SECRET',
        required: true,
        consumers: ['api', 'auth'],
        localFiles: ['apps/api/.dev.vars'],
        ciEnvironment: 'starye-org',
      },
      {
        name: 'CRAWLER_SECRET',
        required: true,
        consumers: ['api', 'crawler', 'ci'],
        localFiles: ['apps/api/.dev.vars', 'packages/crawler/.env'],
        ciEnvironment: 'starye-org',
      },
      {
        name: 'R2_ACCESS_KEY_ID',
        required: true,
        consumers: ['crawler'],
        localFiles: ['packages/crawler/.env'],
        ciEnvironment: 'starye-org',
      },
      {
        name: 'R2_SECRET_ACCESS_KEY',
        required: true,
        consumers: ['crawler'],
        localFiles: ['packages/crawler/.env'],
        ciEnvironment: 'starye-org',
      },
    ],
  },
] as const satisfies readonly TargetProfile[]

export const trackedTargetProfileMap: ReadonlyMap<TargetProfileId, TargetProfile> = new Map(
  trackedTargetProfiles.map(profile => [profile.id, profile]),
)
