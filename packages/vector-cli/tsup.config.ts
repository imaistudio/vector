import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  platform: 'node',
  target: 'node22',
  format: ['esm'],
  bundle: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  external: [],
});
