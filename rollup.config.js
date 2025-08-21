import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';

export default {
  input: 'src/index.ts',
  external: ['diff-match-patch'], // 将diff-match-patch标记为外部依赖
  output: [
    {
      file: 'dist/index.cjs',
      format: 'cjs',
      exports: 'named'
    },
    {
      file: 'dist/index.js', // ESM format as default
      format: 'esm'
    },
    {
      file: 'dist/index.umd.js',
      format: 'umd',
      name: 'TextVersion',
      globals: {
        'diff-match-patch': 'diff_match_patch'
      }
    }
  ],
  plugins: [
    nodeResolve(),
    typescript({
      tsconfig: './tsconfig.json'
    })
  ]
};