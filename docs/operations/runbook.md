# Runbook Operacional

> Documento vivo. Atualizar a cada fase. O objetivo é que qualquer operador consiga: reiniciar, parar, proteger fundos e diagnosticar.

## Como reiniciar o bot

1. `TRADING_KILL_SWITCH=true` no ambiente (via config segura).
2. Encerrar processo com SIGTERM (graceful shutdown: drena fila, persiste estado).
3. `npm run build && npm test` se houve alteração de código.
4. Subir processo; verificar reconstrução de estado (DB) e dedup (nenhum trade duplicado).
5. Desligar kill switch somente após health checks verdes.

## Como matar o bot (emergência)

1. `TRADING_KILL_SWITCH=true`.
2. Derrubar processos se necessário: posições existentes permanecem registradas no DB; estado é reconstruído no restart.
3. Notificar via Telegram (automático) e registrar `system_event`.

## Como verificar posições e transações

- Queries no DB (`positions`, `transactions`) filtrando por `correlation_id`. Todo trade é rastreável de sinal → ordem → tx → posição.

## Como trocar de RPC

1. Configurar `SOLANA_RPC_HTTP` alternativo com endpoint validado.
2. Registrar `system_event` de failover. Nunca failover para RPC desconhecido automaticamente.

## Como retirar fundos (futuro — requer revisão de segurança)

- Sweep da hot wallet para cold wallet é operação manual documentada, nunca automática sem security review.

## Como restaurar o banco

- Backup lógico periódico (pg_dump). Restore e reconciliação on-chain antes de retomar operação.

## Incidentes financeiros

1. Preservar evidências antes de qualquer alteração.
2. Reconstruir timeline: logs + `correlation_id` + DB.
3. Classificar causa raiz: data / signal / strategy / execution / latency / RPC / slippage / risk-block / mercado.
4. Documentar em `docs/operations/incidents/<id>.md` com medidas preventivas.
