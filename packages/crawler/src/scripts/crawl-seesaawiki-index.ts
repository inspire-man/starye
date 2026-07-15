import process from 'node:process'

if (process.argv[1]?.endsWith('crawl-seesaawiki-index.ts')) {
  throw new Error('crawl-seesaawiki-index is blocked until a local-or-external-only guard is registered.')
}
