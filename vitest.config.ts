import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      'three-mesh-bvh': resolve(
        __dirname,
        'node_modules/three-mesh-bvh/src/index.js',
      ),
      'three-bvh-csg': resolve(
        __dirname,
        'node_modules/three-bvh-csg/src/index.js',
      ),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/types.ts', 'src/main.ts'],
      thresholds: {
        'src/parser/': {
          lines: 90,
          branches: 80,
        },
        'src/simulation/': {
          lines: 70,
          branches: 60,
        },
        'src/csg/': {
          lines: 60,
          branches: 50,
        },
        'src/tools/': {
          lines: 70,
          branches: 60,
        },
      },
    },
  },
})
