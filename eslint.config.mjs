import antfu from '@antfu/eslint-config'

export default antfu({
  typescript: true,
  vue: true,
  ignores: [
    '**/dist',
    '**/node_modules',
    '**/.output',
    '**/.nuxt',
    '**/.wrangler',
    '**/.target-wrangler.*.toml',
    '.agent/*',
    '.cursor/*',
    '.github/*',
    '.trae/*',
    'openspec/*',
    'packages/crawler/examples/**',
  ],
  rules: {
    'e18e/prefer-static-regex': 'off',
    'e18e/ban-dependencies': 'off',
  },
})
