import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { runTargetCrawlerMutation } from '../../../scripts/target-crawl-mutation'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
  vi.restoreAllMocks()
})

async function createBackfillEnvironment(): Promise<NodeJS.ProcessEnv> {
  const root = await mkdtemp(path.join(tmpdir(), 'starye-backfill-entry-'))
  roots.push(root)
  const contextPath = path.join(root, 'prepared-context.backfill-run.json')
  const apiConfigPath = path.join(root, 'api.toml')
  const gatewayConfigPath = path.join(root, 'gateway.toml')
  await writeFile(contextPath, JSON.stringify({
    apiConfigPath,
    gatewayConfigPath,
    identity: {
      accountId: 'account-id',
      apiUrl: 'https://api.example.test',
      r2Name: 'starye-media',
    },
    preparedContextPath: contextPath,
    runId: 'backfill-run',
    targetId: 'starye-org',
  }), 'utf8')

  return {
    CRAWLER_SECRET: 'crawler-secret',
    R2_ACCESS_KEY_ID: 'r2-access',
    R2_PUBLIC_URL: 'https://cdn.example.test',
    R2_SECRET_ACCESS_KEY: 'r2-secret',
    STARYE_API_CONFIG_PATH: apiConfigPath,
    STARYE_GATEWAY_CONFIG_PATH: gatewayConfigPath,
    STARYE_PREPARED_CONTEXT_PATH: contextPath,
    STARYE_PREPARED_ENTRY: 'crawler-backfill-covers',
    STARYE_PREPARED_OPERATION: 'backfill-covers',
  }
}

function processedImage(filename: string) {
  return [{
    key: `movies/test/${filename}-preview.webp`,
    size: 123,
    url: `https://cdn.example.test/${filename}-preview.webp`,
    variant: 'preview' as const,
  }]
}

describe('registry-owned JAV.hk media backfill entry', () => {
  it('uploads movie cover, overview, and actress avatar before syncing managed URLs', async () => {
    const environment = await createBackfillEnvironment()
    const process = vi.fn(async (target: { filename: string }) => processedImage(target.filename))
    const syncMovie = vi.fn(async () => ({ success: true }))
    const syncActorDetails = vi.fn(async () => ({ success: true }))
    const createBackfillImageProcessor = vi.fn(() => ({ process }))
    const createBackfillActorSource = vi.fn(() => ({
      findActor: vi.fn(async () => ({ avatar: 'https://i.jav.hk/actress/small/tenma_yui.jpg' })),
    }))
    const createBackfillMovieSource = vi.fn(() => ({
      findMovieImages: vi.fn(async () => ({
        cover: 'https://i.jav.hk/movie/mudr392/small/mudr392pl.jpg',
        preview: 'https://i.jav.hk/movie/mudr392/small/mudr392ps.jpg',
        previewImages: [
          'https://i.jav.hk/movie/mudr392/samples/mudr392-01.jpg',
          'https://i.jav.hk/movie/mudr392/samples/mudr392-02.jpg',
        ],
      })),
    }))
    const createBackfillApiClient = vi.fn(() => ({
      fetchMoviesNeedingImageRefresh: vi.fn(async () => [{ code: 'MUDR-392', sourceUrl: 'https://www.javbus.com/MUDR-392' }]),
      fetchPendingActors: vi.fn(async () => [{ id: 'actor-1', name: '天馬ゆい' }]),
      syncActorDetails,
      syncMovie,
    }))

    await expect(runTargetCrawlerMutation(environment, {
      createBackfillActorSource,
      createBackfillApiClient,
      createBackfillImageProcessor,
      createBackfillMovieSource,
    })).resolves.toBeUndefined()

    expect(createBackfillApiClient).toHaveBeenCalledWith({
      timeout: 60000,
      token: 'crawler-secret',
      url: 'https://api.example.test',
    })
    expect(createBackfillImageProcessor).toHaveBeenCalledWith({
      accessKeyId: 'r2-access',
      accountId: 'account-id',
      bucketName: 'starye-media',
      publicUrl: 'https://cdn.example.test',
      secretAccessKey: 'r2-secret',
    })
    expect(createBackfillActorSource).toHaveBeenCalledOnce()
    expect(createBackfillMovieSource).toHaveBeenCalledOnce()
    expect(process).toHaveBeenCalledTimes(4)
    expect(process.mock.calls).toEqual(expect.arrayContaining([
      [expect.objectContaining({
        filename: 'cover',
        imageUrl: 'https://i.jav.hk/movie/mudr392/small/mudr392pl.jpg',
        purpose: 'cover',
      })],
      [expect.objectContaining({
        filename: 'overview-01',
        imageUrl: 'https://i.jav.hk/movie/mudr392/samples/mudr392-01.jpg',
        purpose: 'cover',
      })],
      [expect.objectContaining({
        filename: 'overview-02',
        imageUrl: 'https://i.jav.hk/movie/mudr392/samples/mudr392-02.jpg',
        purpose: 'cover',
      })],
      [expect.objectContaining({
        filename: 'avatar',
        imageUrl: 'https://i.jav.hk/actress/small/tenma_yui.jpg',
        purpose: 'avatar',
      })],
    ]))
    expect(syncMovie).toHaveBeenCalledWith({
      code: 'MUDR-392',
      coverImage: 'https://cdn.example.test/cover-preview.webp',
      previewImages: [
        'https://cdn.example.test/overview-01-preview.webp',
        'https://cdn.example.test/overview-02-preview.webp',
      ],
    })
    expect(syncActorDetails).toHaveBeenCalledWith('actor-1', { avatar: 'https://cdn.example.test/avatar-preview.webp' })
  })

  it('continues independent candidates after an image-processing or API acknowledgement failure', async () => {
    const environment = await createBackfillEnvironment()
    const process = vi.fn(async (target: { filename: string, keyNamespace: string }) => {
      if (target.keyNamespace === 'movies/BAD-001')
        throw new Error('processor failed')
      return processedImage(target.filename)
    })
    const syncMovie = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ success: true })
    const syncActorDetails = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ success: true })
    const findActor = vi.fn()
      .mockResolvedValueOnce({ avatar: 'https://i.jav.hk/actress/small/bad.jpg' })
      .mockResolvedValueOnce({ avatar: 'https://i.jav.hk/actress/small/good.jpg' })
    const findMovieImages = vi.fn(async (code: string) => ({
      cover: `https://i.jav.hk/movie/${code.toLowerCase()}/small/coverpl.jpg`,
      preview: `https://i.jav.hk/movie/${code.toLowerCase()}/small/coverps.jpg`,
    }))
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    await expect(runTargetCrawlerMutation(environment, {
      createBackfillActorSource: () => ({ findActor }),
      createBackfillMovieSource: () => ({ findMovieImages }),
      createBackfillApiClient: () => ({
        fetchMoviesNeedingImageRefresh: async () => [
          { code: 'BAD-001', sourceUrl: 'https://www.javbus.com/BAD-001' },
          { code: 'ACK-002', sourceUrl: 'https://www.javbus.com/ACK-002' },
          { code: 'GOOD-003', sourceUrl: 'https://www.javbus.com/GOOD-003' },
        ],
        fetchPendingActors: async () => [
          { id: 'actor-bad', name: '坏女优' },
          { id: 'actor-good', name: '好女优' },
        ],
        syncActorDetails,
        syncMovie,
      }),
      createBackfillImageProcessor: () => ({ process }),
    })).resolves.toBeUndefined()

    expect(syncMovie).toHaveBeenCalledTimes(2)
    expect(syncMovie).toHaveBeenLastCalledWith({
      code: 'GOOD-003',
      coverImage: 'https://cdn.example.test/cover-preview.webp',
      previewImages: ['https://cdn.example.test/overview-01-preview.webp'],
    })
    expect(syncActorDetails).toHaveBeenCalledTimes(2)
    expect(syncActorDetails).toHaveBeenLastCalledWith('actor-good', { avatar: 'https://cdn.example.test/avatar-preview.webp' })
  })
})
