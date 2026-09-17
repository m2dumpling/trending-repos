#!/usr/bin/env node

import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST_ROOT = path.join(PROJECT_ROOT, 'dist');

async function main() {
  await rm(DIST_ROOT, { recursive: true, force: true });
  await mkdir(path.join(DIST_ROOT, 'data'), { recursive: true });

  for (const file of ['index.html', 'styles.css', 'app.js']) {
    await cp(path.join(PROJECT_ROOT, file), path.join(DIST_ROOT, file));
  }
  await cp(
    path.join(PROJECT_ROOT, 'data', 'repos.json'),
    path.join(DIST_ROOT, 'data', 'repos.json'),
  );
  await writeFile(path.join(DIST_ROOT, '.nojekyll'), '');
  await cp(path.join(PROJECT_ROOT, 'index.html'), path.join(DIST_ROOT, '404.html'));

  console.log('Static site built at ' + DIST_ROOT);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
