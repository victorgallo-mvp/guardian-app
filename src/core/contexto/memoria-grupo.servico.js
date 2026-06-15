/**
 * Memória de grupo: mantém as estatísticas agregadas de cada grupo
 * (`Grupo.estatisticas`) e o histórico recente de gatilhos detectados,
 * usado tanto para acompanhamento operacional quanto para enriquecer o
 * contexto de padrões recorrentes (ex: "3º sinal de churn essa semana").
 */
import mongoose from "mongoose";
import Grupo from "../../dominio/grupo.modelo.js";
import Analise from "../../dominio/analise.modelo.js";

const DIAS_HISTORICO_GATILHOS_PADRAO = 7;

/** Registra que uma mensagem foi processada pelo pipeline, atualizando estatísticas do grupo. */
export async function registrarMensagemProcessada(grupoId) {
  await Grupo.updateOne(
    { _id: grupoId },
    {
      $inc: { "estatisticas.mensagensProcessadasTotal": 1 },
      $set: { "estatisticas.ultimaAtividade": new Date() }
    }
  );
}

/** Registra que uma notificação foi enviada pro grupo. */
export async function registrarNotificacaoEnviada(grupoId) {
  await Grupo.updateOne({ _id: grupoId }, { $inc: { "estatisticas.notificacoesEnviadas": 1 } });
}

/** Registra feedback de falso positivo (responsável marcou a notificação como irrelevante). */
export async function registrarFalsoPositivo(grupoId) {
  await Grupo.updateOne({ _id: grupoId }, { $inc: { "estatisticas.falsosPositivos": 1 } });
}

/** Registra feedback de alerta relevante confirmado pelo responsável. */
export async function registrarRelevanteConfirmado(grupoId) {
  await Grupo.updateOne({ _id: grupoId }, { $inc: { "estatisticas.relevantesConfirmados": 1 } });
}

/**
 * Retorna um resumo dos gatilhos detectados recentemente num grupo,
 * agrupados por tipo e severidade — usado para identificar padrões
 * recorrentes (ex: múltiplos sinais de risco de cancelamento na semana).
 *
 * @param {import("mongoose").Types.ObjectId|string} grupoId
 * @param {number} dias - janela de histórico em dias
 * @returns {Promise<{gatilho: string, severidade: string, total: number}[]>}
 */
export async function obterHistoricoGatilhos(grupoId, dias = DIAS_HISTORICO_GATILHOS_PADRAO) {
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
  const idGrupo = typeof grupoId === "string" ? new mongoose.Types.ObjectId(grupoId) : grupoId;

  return Analise.aggregate([
    { $match: { grupoId: idGrupo, analisadaEm: { $gte: desde } } },
    {
      $group: {
        _id: { gatilho: "$detectado.gatilho", severidade: "$detectado.severidade" },
        total: { $sum: 1 }
      }
    },
    { $project: { _id: 0, gatilho: "$_id.gatilho", severidade: "$_id.severidade", total: 1 } },
    { $sort: { total: -1 } }
  ]);
}
