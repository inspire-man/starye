import process from 'node:process'

if (process.argv[1]?.endsWith('enrich-players.ts')) {
  throw new Error('enrich-players must run through crawler-enrich-players with an explicit --target.')
}
