import * as esbuild from 'esbuild';

esbuild.build({
  entryPoints: ['server.ts'],
  outfile: 'dist/server.cjs',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  external: ['express', 'vite', 'cloudinary', 'dotenv']
}).catch(() => process.exit(1));
