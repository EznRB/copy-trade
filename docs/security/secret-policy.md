# Política de Segredos e Chaves

## Princípio

**Nenhuma private key ou seed phrase existe neste repositório, em logs, em prompts, em banco de dados ou em frontend.** Segredos vivem exclusivamente no ambiente de execução seguro (variáveis de ambiente do servidor / secret manager).

## Regras

1. **Nunca** solicitar seed phrase. Agentes podem pedir somente: public key, RPC URL, configs não-secretas.
2. **Nunca** `console.log(process.env)` ou logar qualquer valor de `*_KEY`, `*_SECRET`, `*_TOKEN`. Lint bloqueia o padrão mais óbvio; responsabilidade final é do review.
3. `.env` está no `.gitignore` e nunca é commitado. `.env.example` contém apenas placeholders.
4. A bot hot wallet é exclusiva do bot. Arquitetura de fundos: `COLD/MAIN → HOT WALLET → trading → sweep → COLD` (sweep somente após revisão de segurança).
5. Logs passam por redaction middleware (`@ct/logging`) que mascara padrões de chave.
6. `infrastructure/scripts/check-secrets.ps1` deve rodar antes de cada commit relevante (e no CI) — procura padrões de keypair/base58 suspeito.
7. Seeds/keypairs de teste usam fixtures públicos claramente marcados como inválidos.
8. Em incidente: preservar evidências (logs, DB) antes de modificar; reconstruir timeline via `correlation_id`.

## Registro de config sensível

Toda mudança em `TRADING_MODE`, `LIVE_TRADING_ENABLED`, `MAX_*` e `TRADING_KILL_SWITCH` exige: ação explícita humana + versionamento + entrada em `audit_log` (who/what/when/why).

## Classificação de dados

| Tipo                        | Onde pode existir                         |
| --------------------------- | ----------------------------------------- |
| private key / seed          | somente ambiente seguro de execução       |
| API keys (Helius, Telegram) | `.env` local / secret manager do servidor |
| public keys                 | código, configs, DB — livremente          |
| configs de risco            | Git (versionadas) + audit log             |
