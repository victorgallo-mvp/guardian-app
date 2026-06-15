/**
 * Pipeline de processamento de uma mensagem de grupo monitorado: filtros,
 * persistência, triagem (Haiku) e, se necessário, análise profunda
 * (Sonnet) + decisão de notificação.
 *
 * Usado tanto pelo webhook (mensagens recebidas em tempo real) quanto por
 * jobs periódicos (ex: reavaliação de mensagens sem resposta).
 */
import Mensagem from "../dominio/mensagem.modelo.js";
import Analise from "../dominio/analise.modelo.js";
import Cliente from "../dominio/cliente.modelo.js";
import config from "../config/index.js";
import logger from "../infra/logger.js";
import { mensagemEhValida } from "./filtros/mensagem-valida.filtro.js";
import { obterGrupoMonitorado, grupoEmSnooze } from "./filtros/grupo-permitido.filtro.js";
import { obterContextoRecente } from "./contexto/janela-rolante.servico.js";
import { registrarMensagemProcessada } from "./contexto/memoria-grupo.servico.js";
import { limiteDiarioExcedido } from "./ia/controle-custo.servico.js";
import { executarTriagem } from "./ia/triagem.servico.js";
import { executarAnalise } from "./ia/analise.servico.js";
import { deveGerarNotificacao } from "./gatilhos/classificador.js";
import { enviarNotificacoes } from "./notificacao/enviador.servico.js";

/** Extrai o timestamp da mensagem do payload da Evolution API, com fallback pro horário atual. */
function extrairDataRecebimento(mensagemPayload) {
  const timestamp = mensagemPayload?.messageTimestamp;
  return timestamp ? new Date(Number(timestamp) * 1000) : new Date();
}

/** Resolve o nível de sensibilidade efetivo: configuração do grupo > configuração do cliente > padrão. */
export async function obterNivelSensibilidadeEfetivo(grupo) {
  if (grupo.configuracoesEspecificas?.nivelSensibilidade) {
    return grupo.configuracoesEspecificas.nivelSensibilidade;
  }

  const cliente = await Cliente.findOne({ identificador: grupo.clientId }).lean();
  return (
    cliente?.configuracoes?.nivelSensibilidadePadrao ??
    config.clienteReferencia?.configuracoes?.nivelSensibilidadePadrao ??
    "medio"
  );
}

/**
 * Executa a análise profunda de uma mensagem já triada como relevante e,
 * se o resultado justificar, envia notificações aos responsáveis do grupo.
 *
 * Sempre marca `mensagem.analiseProfundaId`, mesmo quando a análise não
 * gera notificação — evita que jobs periódicos reanalisem a mesma mensagem.
 *
 * @returns {Promise<{notificou: boolean}>}
 */
export async function executarAnaliseEDecidirNotificacao({ mensagem, contexto, grupo }) {
  const analise = await executarAnalise({ mensagem, contexto, grupo });
  if (!analise.valido) {
    logger.info("Análise profunda não gerou resultado válido", { motivo: analise.motivo, mensagemId: mensagem._id });
    return { notificou: false };
  }

  const analiseDoc = await Analise.create({
    clientId: grupo.clientId,
    grupoId: grupo._id,
    mensagemId: mensagem._id,
    contextoAnalisado: {
      mensagemAtual: mensagem.conteudo,
      mensagensAnteriores: contexto.mensagensAnteriores,
      totalContexto: contexto.totalContexto
    },
    detectado: {
      gatilho: analise.resultado.gatilho,
      severidade: analise.resultado.severidade,
      confiancaScore: analise.resultado.confiancaScore,
      explicacao: analise.resultado.explicacao,
      citacoes: analise.resultado.citacoes
    },
    contextoDoCliente: analise.resultado.contextoDoCliente,
    recomendacaoAcao: analise.resultado.recomendacaoAcao,
    modeloUsado: analise.modeloUsado,
    custoTokensUsd: analise.custoUsd
  });

  mensagem.analiseProfundaId = analiseDoc._id;
  await mensagem.save();

  if (grupoEmSnooze(grupo)) {
    logger.debug("Grupo em snooze, notificação suprimida", { grupoId: grupo._id });
    return { notificou: false };
  }

  const nivelSensibilidadeEfetivo = await obterNivelSensibilidadeEfetivo(grupo);
  const decisao = deveGerarNotificacao(analise.resultado, grupo, nivelSensibilidadeEfetivo);

  if (!decisao.notificar) {
    logger.debug("Análise não atingiu limiar de notificação", { motivo: decisao.motivo, analiseId: analiseDoc._id });
    return { notificou: false };
  }

  await enviarNotificacoes({ analiseDoc, grupo, mensagem });
  return { notificou: true };
}

/**
 * Processa uma mensagem recebida em um grupo monitorado: filtros,
 * persistência, triagem e (se necessário) análise profunda + notificação.
 *
 * @param {object} mensagemPayload - payload `data` do evento `messages.upsert`
 */
export async function processarMensagemDeGrupo(mensagemPayload) {
  const grupo = await obterGrupoMonitorado(mensagemPayload.key.remoteJid);
  if (!grupo) return;

  const validacao = mensagemEhValida(mensagemPayload, grupo);
  if (!validacao.valida) {
    logger.debug("Mensagem descartada pelo filtro de validade", { motivo: validacao.motivo });
    return;
  }

  const idMensagemWhatsapp = mensagemPayload.key.id;
  const jaProcessada = await Mensagem.findOne({ idMensagemWhatsapp }).lean();
  if (jaProcessada) {
    logger.debug("Mensagem já processada anteriormente, ignorando", { idMensagemWhatsapp });
    return;
  }

  const mensagem = await Mensagem.create({
    clientId: grupo.clientId,
    grupoId: grupo._id,
    idMensagemWhatsapp,
    remetenteJid: mensagemPayload.key.participant ?? mensagemPayload.key.remoteJid,
    remetenteNome: mensagemPayload.pushName ?? "",
    conteudo: validacao.texto,
    tipoMensagem: validacao.tipo,
    recebidaEm: extrairDataRecebimento(mensagemPayload)
  });

  await registrarMensagemProcessada(grupo._id);

  if (await limiteDiarioExcedido(grupo.clientId)) {
    logger.warn("Limite diário de custo de IA atingido, mensagem armazenada sem análise", {
      clientId: grupo.clientId,
      grupoId: grupo._id
    });
    return;
  }

  const contexto = await obterContextoRecente(grupo.clientId, grupo._id, { excluirMensagemId: mensagem._id });

  const triagem = await executarTriagem({ mensagem, contexto, grupo });
  mensagem.triagem = {
    processadaEm: new Date(),
    precisaAtencao: triagem.precisaAtencao,
    confiancaScore: triagem.confiancaScore,
    motivoBreve: triagem.motivoBreve,
    custoUsd: triagem.custoUsd
  };
  await mensagem.save();

  if (!triagem.precisaAtencao) return;

  await executarAnaliseEDecidirNotificacao({ mensagem, contexto, grupo });
}
