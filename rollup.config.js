import typescript from '@rollup/plugin-typescript';
import dts from 'rollup-plugin-dts';

// Node built-ins are never bundled (the SDK has zero runtime dependencies)
const external = [/^node:/];

export default [
  // JS: ESM (dist/index.js) and CommonJS (dist/index.cjs, for require() and Node 16)
  {
    input: 'src/index.ts',
    external,
    output: [
      { file: 'dist/index.js', format: 'esm' },
      { file: 'dist/index.cjs', format: 'cjs', exports: 'named' },
    ],
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
        // the .d.ts bundle comes from rollup-plugin-dts below
        declaration: false,
        declarationMap: false,
      }),
    ],
  },

  // Types: .d.ts for import, .d.cts for require
  {
    input: 'src/index.ts',
    external,
    output: [
      { file: 'dist/index.d.ts', format: 'es' },
      { file: 'dist/index.d.cts', format: 'es' },
    ],
    plugins: [dts()],
  },
];
