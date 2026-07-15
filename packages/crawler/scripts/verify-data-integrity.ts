import process from 'node:process'

if (process.argv[1]?.endsWith('verify-data-integrity.ts')) {
  throw new Error('verify-data-integrity is blocked: it cannot select a target from ambient configuration.')
}
