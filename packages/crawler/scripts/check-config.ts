import process from 'node:process'

export interface PreparedCrawlerDiagnostic {
  readonly declaredSecretKeys: readonly string[]
  readonly declaredKeysPresent: readonly boolean[]
}

export function formatPreparedCrawlerDiagnostic(diagnostic: PreparedCrawlerDiagnostic): string {
  return JSON.stringify({
    declaredSecretKeys: diagnostic.declaredSecretKeys,
    declaredKeysPresent: diagnostic.declaredKeysPresent,
  })
}

if (process.argv[1]?.endsWith('check-config.ts')) {
  throw new Error('check-config must run through crawler-check-config with an explicit --target.')
}
