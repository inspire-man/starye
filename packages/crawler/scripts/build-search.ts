import process from 'node:process'

if (process.argv[1]?.endsWith('build-search.ts')) {
  throw new Error('build-search must run through crawler-search-index with an explicit --target.')
}
