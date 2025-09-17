import { defineConfig, type Options } from 'tsup'

const general = {
  outDir: 'dist',
  dts: true,
  splitting: false,
  sourcemap: true,
  minify: false,
  target: 'es2022',
  external: ['bun:test'],
  treeshake: false,
  bundle: false,
  platform: 'node',
  tsconfig: './tsconfig.build.json',
} satisfies Options

export default defineConfig([
  {
    ...general,
    clean: true,
    entry: ['src', '!src/**/*.test.*'],
    format: ['cjs', 'esm'],
    outExtension({ format }) {
      return {
        js: format === 'cjs' ? '.cjs' : '.js',
      }
    },
  },
])
