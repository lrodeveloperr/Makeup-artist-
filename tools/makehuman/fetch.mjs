// Fetches the pinned MakeHuman commit (data only, sparse) into .cache/makehuman.
// Usage: node tools/makehuman/fetch.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { MAKEHUMAN_REPO, MAKEHUMAN_COMMIT, DEFAULT_ROOT } from './source.mjs';

const dir = process.env.MAKEHUMAN_DIR || DEFAULT_ROOT;
const git = (...args) => execFileSync('git', ['-C', dir, ...args], { stdio: 'inherit', env: { ...process.env, GIT_LFS_SKIP_SMUDGE: '1' } });

if (!fs.existsSync(dir + '/.git')) {
  fs.mkdirSync(dir, { recursive: true });
  git('init', '-q');
  git('remote', 'add', 'origin', MAKEHUMAN_REPO);
  git('sparse-checkout', 'set', '--no-cone', '/LICENSE*.md', '/makehuman/data/3dobjs/', '/makehuman/data/targets/');
}
git('fetch', '-q', '--depth', '1', 'origin', MAKEHUMAN_COMMIT);
git('checkout', '-q', '--detach', MAKEHUMAN_COMMIT);
const head = execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD']).toString().trim();
if (head !== MAKEHUMAN_COMMIT) throw new Error(`expected ${MAKEHUMAN_COMMIT}, got ${head}`);
console.log(`MakeHuman ${head} ready in ${dir}`);
