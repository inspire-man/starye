import process from 'node:process'

if (process.argv[1]?.endsWith('diagnose-seesaawiki-parser.ts')) {
  throw new Error('diagnose-seesaawiki-parser is blocked until a local-or-external-only guard is registered.')
}
