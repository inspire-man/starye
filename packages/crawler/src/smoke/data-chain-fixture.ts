import {
  createDataChainCandidate,
  DATA_CHAIN_FIXTURE_COUNT,
} from '@starye/config'

export interface DataChainFixture {
  readonly code: string
  readonly title: string
  readonly slug: string
  readonly isR18: false
  readonly players: readonly [{ readonly sourceName: 'phase13-smoke', readonly sourceUrl: string, readonly sortOrder: 0 }]
}

export interface DataChainFixtureApiClient {
  syncMovie: (movieData: unknown) => Promise<unknown>
}

export interface CreateDataChainFixtureInput {
  readonly targetId: string
  readonly runId: string
}

export interface RunDataChainFixtureInput extends CreateDataChainFixtureInput {
  readonly apiClient: DataChainFixtureApiClient
  readonly createFixture?: (input: CreateDataChainFixtureInput) => unknown
}

export interface CrawlerSmokeFixtureObservation {
  readonly operation: 'crawler-smoke-fixture'
  readonly status: 'synced'
  readonly itemCode: string
  readonly itemCount: typeof DATA_CHAIN_FIXTURE_COUNT
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort()
  return actual.length === keys.length && actual.every((key, index) => key === keys[index])
}

function assertValidFixture(value: unknown, expectedCode: string): asserts value is DataChainFixture {
  if (!isRecord(value)
    || !hasOnlyKeys(value, ['code', 'isR18', 'players', 'slug', 'title'])
    || value.code !== expectedCode
    || !isNonEmptyText(value.title)
    || !isNonEmptyText(value.slug)
    || value.isR18 !== false
    || !Array.isArray(value.players)
    || value.players.length !== 1
    || !isRecord(value.players[0])
    || !hasOnlyKeys(value.players[0], ['sortOrder', 'sourceName', 'sourceUrl'])
    || value.players[0].sourceName !== 'phase13-smoke'
    || value.players[0].sortOrder !== 0
    || !isNonEmptyText(value.players[0].sourceUrl)
    || !value.players[0].sourceUrl.endsWith(`/${expectedCode}`)) {
    throw new Error('Data-chain fixture is invalid.')
  }
}

function assertAcknowledged(result: unknown): void {
  if (!isRecord(result)
    || result.message !== 'Sync completed'
    || !isRecord(result.result)
    || result.result.success !== 1
    || result.result.failed !== 0) {
    throw new Error('Data-chain fixture sync was not acknowledged.')
  }
}

export function createDataChainFixture(input: CreateDataChainFixtureInput): DataChainFixture {
  const candidate = createDataChainCandidate(input)
  const { itemCode } = candidate
  return {
    code: itemCode,
    title: `Phase 13 smoke fixture ${itemCode}`,
    slug: itemCode,
    isR18: false,
    players: [{
      sourceName: 'phase13-smoke',
      sourceUrl: `https://fixture.invalid/phase13/${itemCode}`,
      sortOrder: 0,
    }],
  }
}

export async function runDataChainFixture(input: RunDataChainFixtureInput): Promise<CrawlerSmokeFixtureObservation> {
  const expectedCode = createDataChainCandidate(input).itemCode
  const fixture = (input.createFixture ?? createDataChainFixture)(input)
  assertValidFixture(fixture, expectedCode)

  assertAcknowledged(await input.apiClient.syncMovie(fixture))
  return {
    operation: 'crawler-smoke-fixture',
    status: 'synced',
    itemCode: expectedCode,
    itemCount: DATA_CHAIN_FIXTURE_COUNT,
  }
}
