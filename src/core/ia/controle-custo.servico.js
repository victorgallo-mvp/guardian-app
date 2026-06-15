/**
 * Controle de custo do pipeline de IA.
 *
 * Calcula o custo em USD de cada chamada à Anthropic com base no uso de
 * tokens, e verifica se o cliente já atingiu o limite diário configurado
 * (LIMITE_CUSTO_DIARIO_USD) — usado pra evitar gastos descontrolados caso
 * um grupo gere volume anormal de mensagens.
 */
import Analise from "../../dominio/analise.modelo.js";
import Mensagem from "../../dominio/mensagem.modelo.js";
import Cliente from "../../dominio/cliente.modelo.js";
import config from "../../config/index.js";
import logger from "../../infra/logger.js";

// Preços em USD por milhão de tokens, por modelo.
// Mantido aqui (em vez de consultar a API a cada chamada) pra evitar
// latência extra — atualizar manualmente se os preços da Anthropic mudarem.
const TABELA_PRECOS_USD_POR_MILHAO_TOKENS = {
  "claude-haiku-4-5": { entrada: 1.0, saida: 5.0 },
  "claude-sonnet-4-5": { entrada: 3.0, saida: 15.0 }
};

const PRECO_PADRAO = { entrada: 3.0, saida: 15.0 };

/**
 * Calcula o custo em USD de uma chamada à API com base no modelo usado
 * e na quantidade de tokens de entrada/saída.
 */
export function calcularCustoUsd(modelo, tokensEntrada, tokensSaida) {
  const precos = TABELA_PRECOS_USD_POR_MILHAO_TOKENS[modelo];

  if (!precos) {
    logger.warn("Modelo sem preço cadastrado, usando preço padrão pra cálculo de custo", { modelo });
  }

  const { entrada, saida } = precos ?? PRECO_PADRAO;

  return (tokensEntrada / 1_000_000) * entrada + (tokensSaida / 1_000_000) * saida;
}

/** Retorna a data/hora correspondente ao início do dia atual (00:00, horário local). */
function inicioDoDia() {
  const agora = new Date();
  return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
}

/**
 * Soma o gasto em USD de um cliente no dia atual, somando o custo das
 * triagens (Haiku) e das análises profundas (Sonnet).
 */
export async function obterGastoDiarioUsd(clientId) {
  const desde = inicioDoDia();

  const [totalAnalises, totalTriagens] = await Promise.all([
    Analise.aggregate([
      { $match: { clientId, analisadaEm: { $gte: desde } } },
      { $group: { _id: null, total: { $sum: "$custoTokensUsd" } } }
    ]),
    Mensagem.aggregate([
      { $match: { clientId, "triagem.processadaEm": { $gte: desde } } },
      { $group: { _id: null, total: { $sum: "$triagem.custoUsd" } } }
    ])
  ]);

  return (totalAnalises[0]?.total ?? 0) + (totalTriagens[0]?.total ?? 0);
}

/**
 * Verifica se o cliente já atingiu (ou ultrapassou) o limite diário de custo.
 *
 * Usa o limite configurado em `Cliente.configuracoes.limiteCustoDiarioUsd`
 * (multi-tenant) quando o cliente está cadastrado no banco, e cai pra
 * `LIMITE_CUSTO_DIARIO_USD` (env) como padrão.
 */
export async function limiteDiarioExcedido(clientId) {
  const [gasto, cliente] = await Promise.all([
    obterGastoDiarioUsd(clientId),
    Cliente.findOne({ identificador: clientId }).lean()
  ]);

  const limite = cliente?.configuracoes?.limiteCustoDiarioUsd ?? config.limites.custoDiarioUsd;

  return gasto >= limite;
}
