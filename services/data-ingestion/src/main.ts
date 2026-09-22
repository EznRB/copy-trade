/**
 * Entrypoint executável do serviço data-ingestion.
 * Uso: node dist/main.js (após `npm run build`), com variáveis de ambiente carregadas.
 */
import { start } from './index.js';

start().catch((err: unknown) => {
  // eslint não permite console; stderr direto é aceitável APENAS aqui (boot fatal).
  process.stderr.write(
    `FATAL boot data-ingestion: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
