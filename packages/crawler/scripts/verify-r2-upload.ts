import process from 'node:process'

if (process.argv[1]?.endsWith('verify-r2-upload.ts')) {
  throw new Error('verify-r2-upload is blocked: it cannot select a target from ambient configuration.')
}
