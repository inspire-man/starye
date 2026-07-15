import process from 'node:process'

if (process.argv[1]?.endsWith('backfill-covers.ts')) {
  throw new Error('backfill-covers must run through crawler-backfill-covers with an explicit --target.')
}
