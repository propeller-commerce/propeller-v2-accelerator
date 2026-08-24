import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm', 'cjs'],
  outExtension({ format }) {
    return { js: format === 'esm' ? '.js' : '.cjs' };
  },
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  external: ['@propeller-commerce/propeller-v2-core-ui'],
});
