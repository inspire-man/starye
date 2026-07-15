import process from 'node:process'

if (process.argv[1]?.endsWith('backfill-publishers.ts')) {
  throw new Error('backfill-publishers must run through crawler-backfill-publishers with an explicit --target.')
}
