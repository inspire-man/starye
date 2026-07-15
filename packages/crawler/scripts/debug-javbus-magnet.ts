import process from 'node:process'

if (process.argv[1]?.endsWith('debug-javbus-magnet.ts')) {
  throw new Error('debug-javbus-magnet is blocked until a local-or-external-only guard is registered.')
}
