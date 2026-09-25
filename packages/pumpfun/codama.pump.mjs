// Gera o decoder TS a partir da IDL oficial do pump-public-docs (ADR-016/ADR-020).
// Uso: node packages/pumpfun/codama.pump.mjs
import { createFromRoot } from 'codama';
import { rootNodeFromAnchor } from '@codama/nodes-from-anchor';
import { renderVisitor } from '@codama/renderers-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const idl = JSON.parse(readFileSync(join(here, 'idl', 'pump.json'), 'utf8'));
const idlAmm = JSON.parse(readFileSync(join(here, 'idl', 'pump_amm.json'), 'utf8'));

const pump = createFromRoot(rootNodeFromAnchor(idl));
const amm = createFromRoot(rootNodeFromAnchor(idlAmm));

import { readdirSync, statSync, writeFileSync, rmSync, renameSync, mkdirSync, existsSync } from 'node:fs';

const genRoot = join(here, 'src', 'generated');
const staging = join(here, '.codama-staging');

// Layout comprovado do renderVisitor: escreve em <outDir>/src/generated.
// Render em staging fora de src, depois achata com verificação explícita.
rmSync(genRoot, { recursive: true, force: true });
rmSync(staging, { recursive: true, force: true });
await pump.accept(renderVisitor(join(staging, 'pump')));
await amm.accept(renderVisitor(join(staging, 'pump_amm')));

for (const proj of ['pump', 'pump_amm']) {
  const deep = join(staging, proj, 'src', 'generated');
  if (!existsSync(deep)) {
    throw new Error(`codama: layout inesperado — ${deep} não existe (verificar renderVisitor)`);
  }
  const dst = join(genRoot, proj);
  mkdirSync(dst, { recursive: true });
  for (const entry of readdirSync(deep)) renameSync(join(deep, entry), join(dst, entry));
}
rmSync(staging, { recursive: true, force: true });

// Pos-processamento documentado: clientes gerados pelo codama nao seguem o
// strict do monorepo (ex.: PDA collisions na IDL oficial geram identificadores
// duplicados). Aplicamos @ts-nocheck APENAS nos arquivos gerados; o wrapper
// decode.ts permanece 100% type-checked.
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.ts')) {
      let src = readFileSync(p, 'utf8');
      // Pós-processamento: apenas @ts-nocheck (codama emite alguns dups de tipo
      // via PDA collisions da IDL oficial; @ts-nocheck os cobre sem alterar runtime).
      if (!src.startsWith('// @ts-nocheck')) src = '// @ts-nocheck\n' + src;
      writeFileSync(p, src);
    }
  }
}
walk(join(here, 'src', 'generated'));

process.stdout.write('codama: gerado em src/generated/{pump,pump_amm}\n');
