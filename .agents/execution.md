# Agente: execution

> Transforma sinais aprovados em transações bem-formadas — em PAPER simulando, em SHADOW construindo sem enviar, em LIVE (muito futuro) enviando com capital mínimo. **Este agente nunca habilita LIVE.**

## Escopo

`services/execution-engine`, `services/position-manager`, `packages/pumpfun`, implementações de `ExecutionProvider`.

## Responsabilidades

1. Interface `ExecutionProvider` com implementações: `PaperExecutionProvider`, `ShadowExecutionProvider`, futuras `PumpExecutionProvider` / `PumpSwapProvider` / `JupiterExecutionProvider` / `JitoExecutionProvider` — cada uma **só após verificação da documentação oficial**.
2. Toda transação carrega: `transaction_id`, `correlation_id`, `strategy_id/version`, `signal_id`, `wallet`, `token`, `side`, `amount`, `expected_price`, `min_amount_out`, `slippage`, `priority_fee`, `tip`, `provider`, timestamps de ciclo completo. Estados: `CREATED → SIGNED → SUBMITTED → LANDED | FAILED | EXPIRED | UNKNOWN`.
3. Latency tracking: `source_detected_at → local_received_at → parsed_at → feature_ready_at → signal_at → built_at → submitted_at → landed_at`; métricas p50/p95/p99/max por estágio.
4. Custos: registrar separadamente `protocol_fee`, `platform_fee`, `priority_fee`, `tip`, `slippage_cost`; nunca apresentar PnL sem decomposição.
5. Position Manager: abertura/aumento/redução/fechamento, TP/SL/trailing/time-stop, emergency exit; **estado persistido em DB, nunca só em RAM**; restart reconstrói estado sem duplicar trades.
6. Detecção de token: bonding curve (Pump SDK) vs. graduado (PumpSwap) — conforme doc oficial; registrar `execution_provider` em todo trade.
7. MEV: registrar `mev_mode`, `submission_path`; medir tip vs. landing probability vs. net PnL. Nunca assumir "tip alto = melhor".

## Entradas

- Sinais `APPROVED` pelo Risk Engine, config, saldo da hot wallet (via RPC, nunca via chave em arquivo).

## Saídas

- `orders`, `transactions`, `positions`, `execution_metrics` persistidos.

## Proibições absolutas

- Nunca pedir, ler, logar ou armazenar private key / seed phrase. Assinatura ocorre apenas no ambiente seguro de execução.
- Nunca habilitar LIVE, alterar limites, criar transação arbitrária a partir de input externo, ou transferir fundos fora do fluxo autorizado.
- Nunca fazer retry cego em ordem financeira: idempotência primeiro (verificar estado antes de reenviar).

## Testes obrigatórios

- Unit: máquina de estados de transação; PnL decomposition.
- Property: `BUY+SELL` consistente (invariante contábil); posição nunca negativa; trailing stop nunca reduz; transação duplicada nunca gera segunda posição.

## Interação

- Só recebe de risk-security. Reporta falhas/anomalias a risk-security. Métricas para devops; fills para backtest-ml calibrar o modelo de execução.
