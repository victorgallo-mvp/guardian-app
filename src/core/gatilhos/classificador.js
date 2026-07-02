/**
 * Classificador de resultados da análise profunda (Sonnet).
 *
 * Recebe o JSON retornado pela IA, valida contra o catálogo de gatilhos
 * e decide se o resultado é forte o suficiente pra gerar uma notificação,
 * considerando o nível de sensibilidade configurado pro grupo/cliente.
 */
import { z } from "zod";
import {
  NIVEIS_SEVERIDADE,
  gatilhoExiste,
  obterGatilhosAplicaveis
} from "./catalogo.gatilhos.js";
import logger from "../../infra/logger.js";

const esquemaResultadoAnalise = z.object({
  gatilho: z.string(),
  severidade: z.enum(NIVEIS_SEVERIDADE),
  confiancaScore: z.number().min(0).max(1),
  explicacao: z.string().min(1),
  citacoes: z.array(z.string()).default([]),
  contextoDoCliente: z.string().optional().default(""),
  recomendacaoAcao: z.string().optional().default("")
});

// Índice mínimo de severidade necessário pra notificar, por nível de sensibilidade.
// Quanto menor o índice, mais sensível (notifica com severidades mais baixas).
const LIMIAR_SEVERIDADE_POR_SENSIBILIDADE = {
  alto: 1, // atencao, urgente, critico
  medio: 2, // urgente, critico
  baixo: 3 // apenas critico
};

// Confiança mínima da IA pra considerar o resultado, independente da severidade.
const CONFIANCA_MINIMA = 0.5;

/**
 * Valida e normaliza o JSON retornado pela análise profunda.
 * Retorna `{ valido: true, resultado }` ou `{ valido: false, motivo }`.
 */
export function validarResultadoAnalise(resultadoBruto, tipoGrupo) {
  const parse = esquemaResultadoAnalise.safeParse(resultadoBruto);

  if (!parse.success) {
    return {
      valido: false,
      motivo: `Resultado da IA fora do formato esperado: ${parse.error.message}`
    };
  }

  const resultado = parse.data;

  if (!gatilhoExiste(resultado.gatilho)) {
    return {
      valido: false,
      motivo: `Gatilho "${resultado.gatilho}" não existe no catálogo`
    };
  }

  const aplicaveis = obterGatilhosAplicaveis(tipoGrupo).map((g) => g.id);
  if (!aplicaveis.includes(resultado.gatilho)) {
    logger.warn("IA classificou gatilho não aplicável ao tipo de grupo", {
      gatilho: resultado.gatilho,
      tipoGrupo
    });
    return {
      valido: false,
      motivo: `Gatilho "${resultado.gatilho}" não é aplicável a grupos do tipo "${tipoGrupo}"`
    };
  }

  return { valido: true, resultado };
}

/**
 * Decide se uma análise validada deve gerar notificação, considerando:
 * - nível de sensibilidade efetivo do grupo (severidade mínima)
 * - confiança mínima da IA
 * - blacklist global (cliente) e por grupo
 *
 * @param {object} analise - resultado validado por `validarResultadoAnalise`
 * @param {object} grupo - documento do grupo (Mongoose)
 * @param {string} nivelSensibilidadeEfetivo - "baixo" | "medio" | "alto"
 * @param {string[]} gatilhosDesativadosGlobal - blacklist global do cliente
 */
export function deveGerarNotificacao(analise, grupo, nivelSensibilidadeEfetivo, gatilhosDesativadosGlobal = []) {
  if (analise.confiancaScore < CONFIANCA_MINIMA) {
    return { notificar: false, motivo: "Confiança da IA abaixo do mínimo aceitável" };
  }

  if (gatilhosDesativadosGlobal.includes(analise.gatilho)) {
    return { notificar: false, motivo: "Gatilho desativado globalmente para este cliente" };
  }

  if (grupo.gatilhosDesativados?.includes(analise.gatilho)) {
    return { notificar: false, motivo: "Gatilho está desativado para este grupo" };
  }

  const indiceSeveridade = NIVEIS_SEVERIDADE.indexOf(analise.severidade);
  const limiar = LIMIAR_SEVERIDADE_POR_SENSIBILIDADE[nivelSensibilidadeEfetivo] ?? LIMIAR_SEVERIDADE_POR_SENSIBILIDADE.medio;

  if (indiceSeveridade < limiar) {
    return { notificar: false, motivo: "Severidade abaixo do limiar de sensibilidade do grupo" };
  }

  return { notificar: true, motivo: "Severidade e confiança dentro do limiar configurado" };
}
