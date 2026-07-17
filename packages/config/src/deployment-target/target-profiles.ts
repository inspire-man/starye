import type { TargetProfile, TargetProfileId } from './target-profile.schema'

export const trackedTargetProfiles = [
  {
    id: 'starye-org',
    account: {
      id: 'd6e57b25da320fae1bd0079fb3c316d4',
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
      dashboard: 'https://starye-dashboard-5fz.pages.dev',
      auth: 'https://starye-auth-die.pages.dev',
      blog: 'https://blog.starye.org',
      movie: 'https://starye-movie-60w.pages.dev',
      comic: 'https://starye-comic-3jr.pages.dev',
      tavern: 'https://tavern.starye.org',
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
        canonicalUrl: 'https://starye-dashboard-5fz.pages.dev',
      },
      auth: {
        project: 'starye-auth',
        canonicalUrl: 'https://starye-auth-die.pages.dev',
      },
      blog: {
        project: 'blog-pages',
        canonicalUrl: 'https://blog.starye.org',
      },
      movie: {
        project: 'starye-movie',
        canonicalUrl: 'https://starye-movie-60w.pages.dev',
      },
      comic: {
        project: 'starye-comic',
        canonicalUrl: 'https://starye-comic-3jr.pages.dev',
      },
    },
    resources: {
      d1: {
        kind: 'd1',
        binding: 'DB',
        name: 'starye-db',
        id: '23dd42f6-1845-4748-b61d-20d755938aaf',
      },
      r2: {
        kind: 'r2',
        binding: 'BUCKET',
        name: 'starye-media',
      },
      kv: {
        kind: 'kv',
        binding: 'CACHE',
        id: 'acf49df06ae0447b82a092cf238714d8',
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
