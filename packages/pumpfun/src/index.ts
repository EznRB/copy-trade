/**
 * @ct/pumpfun — decoder oficial pump.fun / PumpSwap (F1.5).
 *
 * Fontes (ADR-016): IDL oficial pump-fun/pump-public-docs @ 81091419
 * (idl/pump.json, idl/pump_amm.json — vendored em ./idl).
 * Geração (ADR-020): codama → src/generated/ (versionado, verificado por fixtures).
 */
export { PUMPFUN_DOC_SOURCE, PUMPFUN_IDL_SOURCE, PUMPFUN_IDL_SHA } from './sources.js';
export { decodePumpInstruction, type DecodedSwap } from './decode.js';

// Re-exports mínimos para testes de integração (não fazem parte da API pública).
export { getBuyInstructionDataEncoder as PUMP_BUY_ENCODER_FOR_TESTS } from './generated/pump/instructions/index.js';
export { PUMP_PROGRAM_ADDRESS } from './generated/pump/programs/index.js';
export { PUMP_AMM_PROGRAM_ADDRESS } from './generated/pump_amm/programs/index.js';
