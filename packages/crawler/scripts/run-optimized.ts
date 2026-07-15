import process from 'node:process'

if (process.argv[1]?.endsWith('run-optimized.ts')) {
  throw new Error('run-optimized must run through crawler-optimized with an explicit --target.')
}
