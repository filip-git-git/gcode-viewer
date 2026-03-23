import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['src/**/*.{ts,vue}'],
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLElement: 'readonly',
        KeyboardEvent: 'readonly',
        PointerEvent: 'readonly',
        DragEvent: 'readonly',
        FileReader: 'readonly',
        Event: 'readonly',
        performance: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
      parserOptions: {
        parser: tseslint.parser,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': ['warn', {
        allowExpressions: true,
        allowTypedFunctionExpressions: true,
      }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'vue/multi-word-component-names': 'off',
    },
  },
  {
    ignores: ['dist/', 'node_modules/', '*.config.*'],
  },
)
