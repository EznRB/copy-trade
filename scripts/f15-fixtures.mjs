// scripts/f15-fixtures.mjs - GATE F1.5 (fixtures, versao re-review 2ab477f):
// Amostra txs reais do ObservedEvent, decodifica localmente e compara 1:1 com
// a Enhanced API da Helius INCLUINDO direction + user(feePayer) + mint.
// Divergencias sao LISTADAS, nunca engolidas. Erros sao logados (stderr JSON).
// Uso: node --env-file=.env scripts/f15-fixtures.mjs [n]
import { writeFileSync } from 'node:fs';
import { prisma } from '../packages/database/dist/index.js';
import { decodePumpInstruction } from '../packages/pumpfun/dist/index.js';
import { collectInstructionCalls } from '../services/data-ingestion/dist/enricher.js';

const N = Number(process.argv[2] ?? 10);
const TARGET_AMM = 2;
const MAX_TRIES = 300;
const HELIUS_KEY = process.env.HELIUS_API_KEY;
const RPC = process.env.SOLANA_RPC_HTTP;
const REPORT_PATH = 'docs/research/f15/fixtures-report.json';
if (!HELIUS_KEY || !RPC) throw new Error('env incompleto (HELIUS_API_KEY/SOLANA_RPC_HTTP)');

function logErr(context, e) {
  process.stderr.write(
    JSON.stringify({ level: 'error', context, error: String(e?.message ?? e) }) + '\n',
  );
}

async function heliusEnhanced(signature) {
  const res = await fetch(`https://api-mainnet.helius-rpc.com/v0/transactions?api-key=${HELIUS_KEY}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ transactions: [signature] }),
  });
  if (!res.ok) throw new Error(`Enhanced API HTTP ${res.status}`);
  const arr = await res.json();
  return arr[0] ?? null;
}

async function rpcGetTransaction(signature) {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getTransaction',
      params: [signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 1 }],
    }),
  });
  const j = await res.json();
  if (j.error) throw new Error(`RPC error: ${JSON.stringify(j.error).slice(0, 200)}`);
  return j.result ?? null;
}

/** Extrai direction do token transfer do usuario no lado "mint". */
function heliusDirection(enhanced, user, mint) {
  if (!enhanced || !Array.isArray(enhanced.tokenTransfers)) return null;
  const wsol = 'So11111111111111111111111111111111111111112';
  let inTok = 0,
    outTok = 0,
    outSol = 0;
  for (const t of enhanced.tokenTransfers) {
    if (t?.toUserAccount === user && t?.mint === mint) inTok += Number(t.tokenAmount ?? 0);
    if (t?.fromUserAccount === user && t?.mint === mint) outTok += Number(t.tokenAmount ?? 0);
  }
  for (const t of enhanced.nativeTransfers ?? []) {
    if (t?.fromUserAccount === user) outSol += Number(t.amount ?? 0);
  }
  if (inTok > 0) return 'buy';
  if (outTok > 0) return 'sell';
  void outSol;
  return null;
}

const bigRows = await prisma.$queryRawUnsafe(
  `SELECT signature FROM "ObservedEvent" ORDER BY random() LIMIT ${MAX_TRIES}`,
);

const results = [];
const divergences = [];
const probes = { decoded: 0, undecodable: 0, errors: 0 };
let ammOk = 0,
  i = 0;

while (i < bigRows.length && (results.length < N || ammOk < TARGET_AMM)) {
  const { signature } = bigRows[i++];
  try {
    const [tx, enhanced] = await Promise.all([
      rpcGetTransaction(signature),
      heliusEnhanced(signature),
    ]);
    let local = null;
    for (const c of collectInstructionCalls(tx)) {
      const d = decodePumpInstruction(c.programId, c.data, c.accounts);
      if (d) {
        local = d;
        break;
      }
    }
    if (!local) {
      probes.undecodable++;
      continue;
    }
    probes.decoded++;
    if (local.kind.startsWith('pumpswap')) ammOk++;

    const heliusDir = enhanced ? heliusDirection(enhanced, local.user, local.mint) : null;
    const checks = {
      typeSwap: enhanced?.type === 'SWAP' || enhanced?.type === 'SWAP_PARTIAL',
      userEq: enhanced ? enhanced.feePayer === local.user : null,
      directionEq: heliusDir !== null ? heliusDir === local.direction : null,
      // mint: verificacao sobre tokenTransfers quando disponivel
      mintPresent: enhanced?.tokenTransfers?.some((t) => t?.mint === local.mint) ?? null,
    };
    const mismatches = Object.entries(checks)
      .filter(([, v]) => v === false)
      .map(([k]) => k);
    if (mismatches.length > 0) {
      divergences.push({ signature, kind: local.kind, mismatches, local, heliusDir, feePayer: enhanced?.feePayer });
    }
    results.push({ signature, local: { ...local }, heliusDir, feePayer: enhanced?.feePayer ?? null, mismatches });
    await new Promise((r) => setTimeout(r, 300));
  } catch (e) {
    probes.errors++;
    logErr('probe', e);
  }
}

const report = {
  at: new Date().toISOString(),
  sample: results.length,
  pumpswapFixtures: ammOk,
  pumpFixtures: results.length - ammOk,
  perfectMatches: results.filter((r) => r.mismatches.length === 0).length,
  divergencesCount: divergences.length,
  probes,
  divergences,
  results,
};
writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
process.stdout.write(
  JSON.stringify({
    sample: report.sample,
    pumpswap: ammOk,
    perfectMatches: report.perfectMatches,
    divergences: divergences.length,
    reportPath: REPORT_PATH,
  }) + '\n',
);
await prisma.$disconnect();
