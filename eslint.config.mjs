// @ts-check
import js from '@eslint/js'
import stylistic from '@stylistic/eslint-plugin'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist/**', 'data/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  stylistic.configs.customize({
    indent: 2,
    quotes: 'single',
    semi: false,
    braceStyle: 'stroustrup',
    commaDangle: 'always-multiline',
  }),
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
)
