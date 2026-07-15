import process from 'node:process'

if (process.argv[1]?.endsWith('enrich-players-javbus.ts')) {
  throw new Error('enrich-players-javbus must run through crawler-enrich-players-javbus with an explicit --target.')
}
