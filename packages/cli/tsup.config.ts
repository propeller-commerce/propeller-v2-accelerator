import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'bin/create-propeller-shop': 'src/bin/create-propeller-shop.ts',
    'bin/propeller': 'src/bin/propeller.ts',
  },
  format: ['esm'],
  outExtension({ format }) {
    return { js: '.js' };
  },
  dts: false,
  sourcemap: true,
  clean: true,
  target: 'node18',
  // Shebang is required so npm/npx can exec the bin file directly.
  banner: { js: '#!/usr/bin/env node' },
  external: ['fsevents'],
});
