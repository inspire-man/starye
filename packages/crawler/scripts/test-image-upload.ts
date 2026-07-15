import process from 'node:process'

if (process.argv[1]?.endsWith('test-image-upload.ts')) {
  throw new Error('test-image-upload is blocked: it cannot select a target from ambient configuration.')
}
