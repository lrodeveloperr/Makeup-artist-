// Bundles the face preview into build/preview (open build/preview/index.html via tools/serve.mjs).
import * as esbuild from 'esbuild';
import fs from 'node:fs';

fs.rmSync('build/preview', { recursive: true, force: true });
fs.mkdirSync('build/preview', { recursive: true });
await esbuild.build({ entryPoints: ['preview/main.js'], bundle: true, format: 'esm', minify: process.argv.includes('--minify'), outfile: 'build/preview/main.js', logLevel: 'warning', target: 'es2022' });
fs.copyFileSync('preview/index.html', 'build/preview/index.html');
fs.copyFileSync('assets/head.bin.gz', 'build/preview/head.bin.gz');
