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
    '.agent/*',
    '.cursor/*',
    '.github/*',
    '.trae/*',
    'openspec/*',
  ],
  rules: {
    'e18e/prefer-static-regex': 'off',
    'e18e/ban-dependencies': 'off',
  },
})
