// Pos-build: reescreve imports relativos sem extensao para ESM Node (.js / index.js).
// Deterministico e idempotente. Uso: node scripts/fix-esm-imports.mjs
import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, dirname as pdirname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, '..', 'dist');

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (p.endsWith('.js')) yield p;
  }
}

const importRe = /(from|import|export)[^'"]*['"](\.{1,2}(?:\/[^'"]*)?)['"]/g;
function resolveSpec(fileDir, spec) {
  if (spec.endsWith('.js')) return spec;
  const abs = join(fileDir, spec);
  if (existsSync(`${abs}.js`)) return `${spec}.js`;
  if (existsSync(join(abs, 'index.js'))) return `${spec === '.' || spec === '..' ? spec + '/' : spec + '/'}index.js`;
  return spec;
}
let changed = 0;
for (const file of walk(dist)) {
  let src = readFileSync(file, 'utf8');
  const fileDir = pdirname(file);
  const out = src.replace(importRe, (m, kw, spec) => m.replace(spec, resolveSpec(fileDir, spec)));
  if (out !== src) {
    writeFileSync(file, out);
    changed++;
  }
}
process.stdout.write(`fix-esm-imports: ${changed} arquivos ajustados\n`);
